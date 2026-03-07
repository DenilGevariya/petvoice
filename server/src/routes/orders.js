const express = require('express');
const { query } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create order
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { restaurantId, items, notes, orderedVia, aiUpsellAccepted } = req.body;

        if (!restaurantId || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Restaurant and items are required' }
            });
        }

        // Generate order number
        const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

        // Calculate totals
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            let itemData;
            if (item.comboId) {
                const combo = await query('SELECT * FROM combos WHERE id = $1', [item.comboId]);
                if (combo.rows.length > 0) {
                    const c = combo.rows[0];
                    const totalPrice = parseFloat(c.combo_price) * (item.quantity || 1);
                    subtotal += totalPrice;
                    orderItems.push({
                        menuItemId: null,
                        comboId: item.comboId,
                        itemName: c.name,
                        quantity: item.quantity || 1,
                        unitPrice: parseFloat(c.combo_price),
                        totalPrice,
                        isUpsell: item.isUpsell || false
                    });
                }
            } else if (item.menuItemId) {
                const menuItem = await query('SELECT * FROM menu_items WHERE id = $1', [item.menuItemId]);
                if (menuItem.rows.length > 0) {
                    const mi = menuItem.rows[0];
                    const totalPrice = parseFloat(mi.price) * (item.quantity || 1);
                    subtotal += totalPrice;
                    orderItems.push({
                        menuItemId: item.menuItemId,
                        comboId: null,
                        itemName: mi.name,
                        quantity: item.quantity || 1,
                        unitPrice: parseFloat(mi.price),
                        totalPrice,
                        isUpsell: item.isUpsell || false
                    });
                }
            }
        }

        const tax = subtotal * 0.05; // 5% tax
        const total = subtotal + tax;

        // Create order
        const orderResult = await query(
            `INSERT INTO orders (user_id, restaurant_id, order_number, subtotal, tax, total, notes, ordered_via, ai_upsell_accepted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [req.user.id, restaurantId, orderNumber, subtotal.toFixed(2), tax.toFixed(2), total.toFixed(2), notes || null, orderedVia || 'voice', aiUpsellAccepted || false]
        );

        const order = orderResult.rows[0];

        // Insert order items
        for (const item of orderItems) {
            await query(
                `INSERT INTO order_items (order_id, menu_item_id, combo_id, item_name, quantity, unit_price, total_price, is_upsell)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [order.id, item.menuItemId, item.comboId, item.itemName, item.quantity, item.unitPrice, item.totalPrice, item.isUpsell]
            );

            // Update POS data - menu item sales
            if (item.menuItemId) {
                await query(
                    `UPDATE menu_items SET 
            total_sales = total_sales + $1::integer,
            total_revenue = total_revenue + $2::numeric
           WHERE id = $3`,
                    [item.quantity, item.totalPrice, item.menuItemId]
                );

                // Update daily sales
                await query(
                    `INSERT INTO daily_sales (restaurant_id, menu_item_id, sale_date, quantity_sold, revenue, cost, profit)
           VALUES ($1, $2, CURRENT_DATE, $3::integer, $4::numeric, 
             (SELECT cost_price * $3::integer FROM menu_items WHERE id = $2),
             $4::numeric - (SELECT cost_price * $3::integer FROM menu_items WHERE id = $2))
           ON CONFLICT (restaurant_id, menu_item_id, sale_date)
           DO UPDATE SET
             quantity_sold = daily_sales.quantity_sold + $3::integer,
             revenue = daily_sales.revenue + $4::numeric,
             cost = daily_sales.cost + (SELECT cost_price * $3::integer FROM menu_items WHERE id = $2),
             profit = daily_sales.profit + ($4::numeric - (SELECT cost_price * $3::integer FROM menu_items WHERE id = $2))`,
                    [restaurantId, item.menuItemId, item.quantity, item.totalPrice]
                );
            }

            // Update combo sales
            if (item.comboId) {
                await query(
                    'UPDATE combos SET total_sales = total_sales + $1::integer WHERE id = $2',
                    [item.quantity, item.comboId]
                );
            }
        }

        // Update restaurant stats
        await query(
            `UPDATE restaurants SET 
        total_orders = total_orders + 1,
        total_revenue = total_revenue + $1::numeric
       WHERE id = $2`,
            [total, restaurantId]
        );

        // Update co-purchase data for market basket analysis
        const menuItemIds = Array.from(new Set(orderItems.filter(i => i.menuItemId).map(i => i.menuItemId)));
        for (let i = 0; i < menuItemIds.length; i++) {
            for (let j = i + 1; j < menuItemIds.length; j++) {
                const [itemA, itemB] = [menuItemIds[i], menuItemIds[j]].sort();
                await query(
                    `INSERT INTO item_co_purchases (restaurant_id, item_a_id, item_b_id, co_purchase_count)
           VALUES ($1, $2, $3, 1)
           ON CONFLICT (restaurant_id, item_a_id, item_b_id)
           DO UPDATE SET co_purchase_count = item_co_purchases.co_purchase_count + 1, updated_at = NOW()`,
                    [restaurantId, itemA, itemB]
                );
            }
        }

        // Update item classifications after order
        await updateClassifications(restaurantId);

        res.status(201).json({
            success: true,
            data: {
                id: order.id,
                orderNumber: order.order_number,
                status: order.status,
                subtotal: parseFloat(order.subtotal),
                tax: parseFloat(order.tax),
                total: parseFloat(order.total),
                items: orderItems,
                createdAt: order.created_at
            }
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: error.message, stack: error.stack }
        });
    }
});

// Get user's orders
router.get('/my-orders', authMiddleware, async (req, res) => {
    try {
        const orders = await query(
            `SELECT o.*, r.name as restaurant_name 
       FROM orders o 
       JOIN restaurants r ON o.restaurant_id = r.id 
       WHERE o.user_id = $1 
       ORDER BY o.created_at DESC 
       LIMIT 50`,
            [req.user.id]
        );

        const ordersWithItems = await Promise.all(
            orders.rows.map(async (order) => {
                const items = await query(
                    'SELECT * FROM order_items WHERE order_id = $1',
                    [order.id]
                );
                return {
                    id: order.id,
                    orderNumber: order.order_number,
                    restaurantName: order.restaurant_name,
                    restaurantId: order.restaurant_id,
                    status: order.status,
                    subtotal: parseFloat(order.subtotal),
                    tax: parseFloat(order.tax),
                    discount: parseFloat(order.discount),
                    total: parseFloat(order.total),
                    orderedVia: order.ordered_via,
                    aiUpsellAccepted: order.ai_upsell_accepted,
                    notes: order.notes,
                    items: items.rows.map(i => ({
                        id: i.id,
                        itemName: i.item_name,
                        quantity: i.quantity,
                        unitPrice: parseFloat(i.unit_price),
                        totalPrice: parseFloat(i.total_price),
                        isUpsell: i.is_upsell
                    })),
                    createdAt: order.created_at
                };
            })
        );

        res.json({ success: true, data: ordersWithItems });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get orders' } });
    }
});

// Get restaurant orders (for owner)
router.get('/restaurant/:restaurantId', authMiddleware, async (req, res) => {
    try {
        // Verify ownership
        const ownership = await query('SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2', [req.params.restaurantId, req.user.id]);
        if (ownership.rows.length === 0) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your restaurant' } });
        }

        const { status, limit } = req.query;
        let sql = `
      SELECT o.*, u.full_name as customer_name 
      FROM orders o 
      JOIN users u ON o.user_id = u.id 
      WHERE o.restaurant_id = $1
    `;
        const params = [req.params.restaurantId];
        let paramIndex = 2;

        if (status) {
            sql += ` AND o.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        sql += ` ORDER BY o.created_at DESC LIMIT $${paramIndex}`;
        params.push(parseInt(limit) || 50);

        const orders = await query(sql, params);

        const ordersWithItems = await Promise.all(
            orders.rows.map(async (order) => {
                const items = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
                return {
                    id: order.id,
                    orderNumber: order.order_number,
                    customerName: order.customer_name,
                    status: order.status,
                    subtotal: parseFloat(order.subtotal),
                    tax: parseFloat(order.tax),
                    total: parseFloat(order.total),
                    orderedVia: order.ordered_via,
                    aiUpsellAccepted: order.ai_upsell_accepted,
                    items: items.rows.map(i => ({
                        itemName: i.item_name,
                        quantity: i.quantity,
                        unitPrice: parseFloat(i.unit_price),
                        totalPrice: parseFloat(i.total_price),
                        isUpsell: i.is_upsell
                    })),
                    createdAt: order.created_at
                };
            })
        );

        res.json({ success: true, data: ordersWithItems });
    } catch (error) {
        console.error('Get restaurant orders error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get orders' } });
    }
});

// Update order status
router.patch('/:id/status', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid status' } });
        }

        const result = await query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
        }

        res.json({ success: true, data: { id: result.rows[0].id, status: result.rows[0].status } });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order' } });
    }
});

// Helper: Update item classifications based on sales data
async function updateClassifications(restaurantId) {
    try {
        const items = await query(
            'SELECT id, total_sales, price, cost_price FROM menu_items WHERE restaurant_id = $1',
            [restaurantId]
        );

        if (items.rows.length === 0) return;

        // Calculate averages
        const avgSales = items.rows.reduce((sum, i) => sum + (i.total_sales || 0), 0) / items.rows.length;
        const avgMargin = items.rows.reduce((sum, i) => sum + (parseFloat(i.price) - parseFloat(i.cost_price)), 0) / items.rows.length;

        for (const item of items.rows) {
            const margin = parseFloat(item.price) - parseFloat(item.cost_price);
            const sales = item.total_sales || 0;
            let classification = 'unclassified';

            if (sales >= avgSales && margin >= avgMargin) {
                classification = 'star';
            } else if (sales >= avgSales && margin < avgMargin) {
                classification = 'workhorse';
            } else if (sales < avgSales && margin >= avgMargin) {
                classification = 'puzzle';
            } else {
                classification = 'dog';
            }

            // Calculate popularity score (0-100)
            const maxSales = Math.max(...items.rows.map(i => i.total_sales || 0), 1);
            const popularityScore = ((sales / maxSales) * 100).toFixed(2);

            await query(
                'UPDATE menu_items SET classification = $1, popularity_score = $2 WHERE id = $3',
                [classification, popularityScore, item.id]
            );
        }
    } catch (error) {
        console.error('Update classifications error:', error);
    }
}

// Voice order — accepts item names (from Vapi AI), resolves to menu_item IDs, creates order
router.post('/voice-order', authMiddleware, async (req, res) => {
    try {
        const { restaurantId, items } = req.body;
        // items = [{ name: "Veg Burger", quantity: 2 }, ...]

        if (!restaurantId || !items || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Restaurant and items are required' }
            });
        }

        // Fetch all menu items for this restaurant
        const menuRes = await query(
            'SELECT id, name, price, cost_price FROM menu_items WHERE restaurant_id = $1 AND is_available = true',
            [restaurantId]
        );

        // Fetch combos for this restaurant
        const comboRes = await query(
            'SELECT id, name, combo_price, original_price FROM combos WHERE restaurant_id = $1 AND is_active = true',
            [restaurantId]
        );

        if (menuRes.rows.length === 0 && comboRes.rows.length === 0) {
            return res.status(400).json({ success: false, error: { code: 'NO_MENU', message: 'No menu items or combos found' } });
        }

        // Resolve item names to IDs (case-insensitive fuzzy match)
        const resolvedItems = [];
        const notFound = [];

        for (const orderItem of items) {
            const nameLower = (orderItem.name || '').toLowerCase().trim();

            // Try matching menu item first
            let menuMatch = menuRes.rows.find(mi => mi.name.toLowerCase() === nameLower);
            if (!menuMatch) {
                menuMatch = menuRes.rows.find(mi => mi.name.toLowerCase().includes(nameLower) || nameLower.includes(mi.name.toLowerCase()));
            }

            // If not found in menu items, try matching combos
            let comboMatch = null;
            if (!menuMatch) {
                comboMatch = comboRes.rows.find(c => c.name.toLowerCase() === nameLower);
                if (!comboMatch) {
                    comboMatch = comboRes.rows.find(c => c.name.toLowerCase().includes(nameLower) || nameLower.includes(c.name.toLowerCase()));
                }
            }

            if (menuMatch) {
                resolvedItems.push({
                    type: 'menu_item',
                    id: menuMatch.id,
                    match: menuMatch,
                    quantity: orderItem.quantity || 1,
                    isUpsell: false,
                });
            } else if (comboMatch) {
                resolvedItems.push({
                    type: 'combo',
                    id: comboMatch.id,
                    match: comboMatch,
                    quantity: orderItem.quantity || 1,
                    isUpsell: false,
                });
            } else {
                notFound.push(orderItem.name);
            }
        }

        if (resolvedItems.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'NO_MATCH', message: `Could not find menu items: ${notFound.join(', ')}` }
            });
        }

        // Compute totals
        const orderNumber = 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
        let subtotal = 0;
        const orderItems = [];

        for (const ri of resolvedItems) {
            let totalPrice = 0;
            let unitPrice = 0;
            let itemName = '';

            if (ri.type === 'menu_item') {
                unitPrice = parseFloat(ri.match.price);
                totalPrice = unitPrice * ri.quantity;
                itemName = ri.match.name;
                orderItems.push({
                    menuItemId: ri.id,
                    comboId: null,
                    itemName: itemName,
                    quantity: ri.quantity,
                    unitPrice: unitPrice,
                    totalPrice,
                    isUpsell: false,
                });
            } else {
                unitPrice = parseFloat(ri.match.combo_price);
                totalPrice = unitPrice * ri.quantity;
                itemName = ri.match.name;
                orderItems.push({
                    menuItemId: null,
                    comboId: ri.id,
                    itemName: itemName,
                    quantity: ri.quantity,
                    unitPrice: unitPrice,
                    totalPrice,
                    isUpsell: false,
                });
            }
            subtotal += totalPrice;
        }

        const tax = subtotal * 0.05;
        const total = subtotal + tax;

        // Insert order with status 'delivered'
        const orderResult = await query(
            `INSERT INTO orders (user_id, restaurant_id, order_number, status, subtotal, tax, total, ordered_via, ai_upsell_accepted)
             VALUES ($1, $2, $3, 'delivered', $4, $5, $6, 'voice', false) RETURNING *`,
            [req.user.id, restaurantId, orderNumber, subtotal.toFixed(2), tax.toFixed(2), total.toFixed(2)]
        );
        const order = orderResult.rows[0];

        // Insert order items + update POS
        for (const item of orderItems) {
            await query(
                `INSERT INTO order_items (order_id, menu_item_id, combo_id, item_name, quantity, unit_price, total_price, is_upsell)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [order.id, item.menuItemId, item.comboId, item.itemName, item.quantity, item.unitPrice, item.totalPrice, false]
            );

            if (item.menuItemId) {
                // Update menu_items sales
                await query(
                    `UPDATE menu_items SET total_sales = total_sales + $1::integer, total_revenue = total_revenue + $2::numeric WHERE id = $3`,
                    [item.quantity, item.totalPrice, item.menuItemId]
                );

                // Update daily_sales
                await query(
                    `INSERT INTO daily_sales (restaurant_id, menu_item_id, sale_date, quantity_sold, revenue, cost, profit)
                     VALUES ($1, $2, CURRENT_DATE, $3::integer, $4::numeric,
                       (SELECT cost_price * $3::integer FROM menu_items WHERE id = $2),
                       $4::numeric - (SELECT cost_price * $3::integer FROM menu_items WHERE id = $2))
                     ON CONFLICT (restaurant_id, menu_item_id, sale_date)
                     DO UPDATE SET
                       quantity_sold = daily_sales.quantity_sold + $3::integer,
                       revenue = daily_sales.revenue + $4::numeric,
                       cost = daily_sales.cost + (SELECT cost_price * $3::integer FROM menu_items WHERE id = $2),
                       profit = daily_sales.profit + ($4::numeric - (SELECT cost_price * $3::integer FROM menu_items WHERE id = $2))`,
                    [restaurantId, item.menuItemId, item.quantity, item.totalPrice]
                );
            } else if (item.comboId) {
                // Update combo sales
                await query(
                    'UPDATE combos SET total_sales = total_sales + $1::integer WHERE id = $2',
                    [item.quantity, item.comboId]
                );
            }
        }

        // Update restaurant stats
        await query(
            `UPDATE restaurants SET total_orders = total_orders + 1, total_revenue = total_revenue + $1::numeric WHERE id = $2`,
            [total, restaurantId]
        );

        // Update co-purchases
        const menuItemIds = Array.from(new Set(orderItems.map(i => i.menuItemId)));
        for (let i = 0; i < menuItemIds.length; i++) {
            for (let j = i + 1; j < menuItemIds.length; j++) {
                const [itemA, itemB] = [menuItemIds[i], menuItemIds[j]].sort();
                await query(
                    `INSERT INTO item_co_purchases (restaurant_id, item_a_id, item_b_id, co_purchase_count)
                     VALUES ($1, $2, $3, 1)
                     ON CONFLICT (restaurant_id, item_a_id, item_b_id)
                     DO UPDATE SET co_purchase_count = item_co_purchases.co_purchase_count + 1, updated_at = NOW()`,
                    [restaurantId, itemA, itemB]
                );
            }
        }

        // Update classifications
        await updateClassifications(restaurantId);

        res.status(201).json({
            success: true,
            data: {
                id: order.id,
                orderNumber: order.order_number,
                subtotal: parseFloat(order.subtotal),
                tax: parseFloat(order.tax),
                total: parseFloat(order.total),
                items: orderItems,
                notFound,
            }
        });
    } catch (error) {
        console.error('Voice order error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } });
    }
});

module.exports = router;
