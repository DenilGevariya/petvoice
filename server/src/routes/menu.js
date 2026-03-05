const express = require('express');
const { query } = require('../config/db');
const { authMiddleware, ownerMiddleware } = require('../middleware/auth');

const router = express.Router();

// ================== CATEGORIES ==================

// Get categories for a restaurant
router.get('/categories/:restaurantId', async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM menu_categories WHERE restaurant_id = $1 AND is_active = true ORDER BY sort_order ASC, name ASC',
            [req.params.restaurantId]
        );
        res.json({
            success: true,
            data: result.rows.map(formatCategory)
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get categories' } });
    }
});

// Create category
router.post('/categories', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const { restaurantId, name, description, sortOrder } = req.body;

        // Verify ownership
        const ownership = await query('SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2', [restaurantId, req.user.id]);
        if (ownership.rows.length === 0) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your restaurant' } });
        }

        const result = await query(
            'INSERT INTO menu_categories (restaurant_id, name, description, sort_order) VALUES ($1, $2, $3, $4) RETURNING *',
            [restaurantId, name, description || null, sortOrder || 0]
        );

        res.status(201).json({ success: true, data: formatCategory(result.rows[0]) });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create category' } });
    }
});

// ================== MENU ITEMS ==================

// Get menu items for a restaurant
router.get('/:restaurantId', async (req, res) => {
    try {
        const { category, available } = req.query;
        let sql = `
      SELECT mi.*, mc.name as category_name 
      FROM menu_items mi 
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id 
      WHERE mi.restaurant_id = $1
    `;
        const params = [req.params.restaurantId];
        let paramIndex = 2;

        if (category) {
            sql += ` AND mi.category_id = $${paramIndex}`;
            params.push(category);
            paramIndex++;
        }

        if (available !== undefined) {
            sql += ` AND mi.is_available = $${paramIndex}`;
            params.push(available === 'true');
            paramIndex++;
        }

        sql += ' ORDER BY mc.sort_order ASC, mi.name ASC';

        const result = await query(sql, params);
        res.json({
            success: true,
            data: result.rows.map(formatMenuItem)
        });
    } catch (error) {
        console.error('Get menu items error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get menu items' } });
    }
});

// Create menu item
router.post('/', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const { restaurantId, categoryId, name, description, price, costPrice, isAvailable, isVeg, isBestseller, spiceLevel, preparationTime } = req.body;

        // Verify ownership
        const ownership = await query('SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2', [restaurantId, req.user.id]);
        if (ownership.rows.length === 0) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your restaurant' } });
        }

        const result = await query(
            `INSERT INTO menu_items (restaurant_id, category_id, name, description, price, cost_price, is_available, is_veg, is_bestseller, spice_level, preparation_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
            [restaurantId, categoryId || null, name, description || null, price, costPrice || 0, isAvailable !== false, isVeg || false, isBestseller || false, spiceLevel || 0, preparationTime || 15]
        );

        res.status(201).json({ success: true, data: formatMenuItem(result.rows[0]) });
    } catch (error) {
        console.error('Create menu item error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create menu item' } });
    }
});

// Update menu item
router.put('/:id', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const { name, description, price, costPrice, categoryId, isAvailable, isVeg, isBestseller, spiceLevel, preparationTime } = req.body;

        // Verify ownership through restaurant
        const item = await query(
            `SELECT mi.id FROM menu_items mi 
       JOIN restaurants r ON mi.restaurant_id = r.id 
       WHERE mi.id = $1 AND r.owner_id = $2`,
            [req.params.id, req.user.id]
        );

        if (item.rows.length === 0) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
        }

        const result = await query(
            `UPDATE menu_items SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        cost_price = COALESCE($4, cost_price),
        category_id = COALESCE($5, category_id),
        is_available = COALESCE($6, is_available),
        is_veg = COALESCE($7, is_veg),
        is_bestseller = COALESCE($8, is_bestseller),
        spice_level = COALESCE($9, spice_level),
        preparation_time = COALESCE($10, preparation_time)
       WHERE id = $11
       RETURNING *`,
            [name, description, price, costPrice, categoryId, isAvailable, isVeg, isBestseller, spiceLevel, preparationTime, req.params.id]
        );

        res.json({ success: true, data: formatMenuItem(result.rows[0]) });
    } catch (error) {
        console.error('Update menu item error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update menu item' } });
    }
});

// Delete menu item
router.delete('/:id', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const item = await query(
            `SELECT mi.id FROM menu_items mi 
       JOIN restaurants r ON mi.restaurant_id = r.id 
       WHERE mi.id = $1 AND r.owner_id = $2`,
            [req.params.id, req.user.id]
        );

        if (item.rows.length === 0) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
        }

        await query('DELETE FROM menu_items WHERE id = $1', [req.params.id]);
        res.json({ success: true, data: { message: 'Menu item deleted' } });
    } catch (error) {
        console.error('Delete menu item error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete menu item' } });
    }
});

// ================== COMBOS ==================

// Get combos for a restaurant
router.get('/combos/:restaurantId', async (req, res) => {
    try {
        const combos = await query(
            'SELECT * FROM combos WHERE restaurant_id = $1 AND is_active = true ORDER BY name ASC',
            [req.params.restaurantId]
        );

        const combosWithItems = await Promise.all(
            combos.rows.map(async (combo) => {
                const items = await query(
                    `SELECT ci.quantity, mi.id, mi.name, mi.price 
           FROM combo_items ci 
           JOIN menu_items mi ON ci.menu_item_id = mi.id 
           WHERE ci.combo_id = $1`,
                    [combo.id]
                );
                return {
                    ...formatCombo(combo),
                    items: items.rows
                };
            })
        );

        res.json({ success: true, data: combosWithItems });
    } catch (error) {
        console.error('Get combos error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get combos' } });
    }
});

// Create combo
router.post('/combos', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const { restaurantId, name, description, comboPrice, items } = req.body;

        const ownership = await query('SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2', [restaurantId, req.user.id]);
        if (ownership.rows.length === 0) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your restaurant' } });
        }

        // Calculate original price
        let originalPrice = 0;
        for (const item of items) {
            const menuItem = await query('SELECT price FROM menu_items WHERE id = $1', [item.menuItemId]);
            if (menuItem.rows.length > 0) {
                originalPrice += parseFloat(menuItem.rows[0].price) * (item.quantity || 1);
            }
        }

        const discountPercentage = originalPrice > 0 ? ((originalPrice - comboPrice) / originalPrice * 100) : 0;

        const comboResult = await query(
            `INSERT INTO combos (restaurant_id, name, description, combo_price, original_price, discount_percentage)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [restaurantId, name, description || null, comboPrice, originalPrice, discountPercentage.toFixed(2)]
        );

        const combo = comboResult.rows[0];

        // Add combo items
        for (const item of items) {
            await query(
                'INSERT INTO combo_items (combo_id, menu_item_id, quantity) VALUES ($1, $2, $3)',
                [combo.id, item.menuItemId, item.quantity || 1]
            );
        }

        res.status(201).json({ success: true, data: formatCombo(combo) });
    } catch (error) {
        console.error('Create combo error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create combo' } });
    }
});

function formatCategory(c) {
    return {
        id: c.id,
        restaurantId: c.restaurant_id,
        name: c.name,
        description: c.description,
        sortOrder: c.sort_order,
        isActive: c.is_active,
        createdAt: c.created_at
    };
}

function formatMenuItem(item) {
    return {
        id: item.id,
        restaurantId: item.restaurant_id,
        categoryId: item.category_id,
        categoryName: item.category_name || null,
        name: item.name,
        description: item.description,
        price: parseFloat(item.price),
        costPrice: parseFloat(item.cost_price),
        imageUrl: item.image_url,
        isAvailable: item.is_available,
        isVeg: item.is_veg,
        isBestseller: item.is_bestseller,
        spiceLevel: item.spice_level,
        preparationTime: item.preparation_time,
        totalSales: item.total_sales || 0,
        totalRevenue: parseFloat(item.total_revenue) || 0,
        avgDailySales: parseFloat(item.avg_daily_sales) || 0,
        popularityScore: parseFloat(item.popularity_score) || 0,
        classification: item.classification,
        contributionMargin: parseFloat(item.price) - parseFloat(item.cost_price),
        marginPercentage: parseFloat(item.price) > 0 ? (((parseFloat(item.price) - parseFloat(item.cost_price)) / parseFloat(item.price)) * 100).toFixed(1) : 0,
        createdAt: item.created_at,
        updatedAt: item.updated_at
    };
}

function formatCombo(c) {
    return {
        id: c.id,
        restaurantId: c.restaurant_id,
        name: c.name,
        description: c.description,
        comboPrice: parseFloat(c.combo_price),
        originalPrice: parseFloat(c.original_price),
        discountPercentage: parseFloat(c.discount_percentage),
        isActive: c.is_active,
        totalSales: c.total_sales || 0,
        createdAt: c.created_at
    };
}

module.exports = router;
