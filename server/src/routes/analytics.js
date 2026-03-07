const express = require('express');
const { query } = require('../config/db');
const { generateJSON } = require('../config/gemini');
const { authMiddleware, ownerMiddleware } = require('../middleware/auth');

const router = express.Router();

// ================== DASHBOARD OVERVIEW ==================
router.get('/dashboard/:restaurantId', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;

        // Verify ownership
        const ownership = await query('SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2', [restaurantId, req.user.id]);
        if (ownership.rows.length === 0) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your restaurant' } });
        }

        const restaurant = await query('SELECT * FROM restaurants WHERE id = $1', [restaurantId]);

        // ── Today's stats (orders, revenue, profit) ──
        const todayOrders = await query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
             FROM orders WHERE restaurant_id = $1 AND DATE(created_at) = CURRENT_DATE`,
            [restaurantId]
        );

        const todayProfit = await query(
            `SELECT COALESCE(SUM(oi.quantity * (oi.unit_price - mi.cost_price)), 0) as profit
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1 AND DATE(o.created_at) = CURRENT_DATE`,
            [restaurantId]
        );

        // ── This week's stats ──
        const weekOrders = await query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
             FROM orders WHERE restaurant_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
            [restaurantId]
        );

        const weekProfit = await query(
            `SELECT COALESCE(SUM(oi.quantity * (oi.unit_price - mi.cost_price)), 0) as profit
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'`,
            [restaurantId]
        );

        // ── This month's stats ──
        const monthOrders = await query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue
             FROM orders WHERE restaurant_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
            [restaurantId]
        );

        const monthProfit = await query(
            `SELECT COALESCE(SUM(oi.quantity * (oi.unit_price - mi.cost_price)), 0) as profit
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'`,
            [restaurantId]
        );

        // ── Weekly item trends (last 7 days, per item per day) ──
        const weeklyItemTrends = await query(
            `SELECT mi.name, DATE(o.created_at) as sale_date, SUM(oi.quantity) as qty
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY mi.name, DATE(o.created_at)
             ORDER BY sale_date`,
            [restaurantId]
        );

        // ── Monthly item trends (last 30 days, per item per day) ──
        const monthlyItemTrends = await query(
            `SELECT mi.name, DATE(o.created_at) as sale_date, SUM(oi.quantity) as qty
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY mi.name, DATE(o.created_at)
             ORDER BY sale_date`,
            [restaurantId]
        );

        // ── Weekly analysis: top item, total qty, items trending up/down ──
        const weeklyTopItems = await query(
            `SELECT mi.name, SUM(oi.quantity) as total_qty
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY mi.name
             ORDER BY total_qty DESC LIMIT 5`,
            [restaurantId]
        );

        // For weekly trend (first-half vs second-half of 7 days)
        const weeklyHalfTrends = await query(
            `SELECT mi.name,
                SUM(CASE WHEN o.created_at < CURRENT_DATE - INTERVAL '3 days' THEN oi.quantity ELSE 0 END) as first_half,
                SUM(CASE WHEN o.created_at >= CURRENT_DATE - INTERVAL '3 days' THEN oi.quantity ELSE 0 END) as second_half
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY mi.name`,
            [restaurantId]
        );

        // ── Monthly analysis: top item, items trending up/down ──
        const monthlyTopItems = await query(
            `SELECT mi.name, SUM(oi.quantity) as total_qty
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY mi.name
             ORDER BY total_qty DESC LIMIT 5`,
            [restaurantId]
        );

        const monthlyHalfTrends = await query(
            `SELECT mi.name,
                SUM(CASE WHEN o.created_at < CURRENT_DATE - INTERVAL '15 days' THEN oi.quantity ELSE 0 END) as first_half,
                SUM(CASE WHEN o.created_at >= CURRENT_DATE - INTERVAL '15 days' THEN oi.quantity ELSE 0 END) as second_half
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
             GROUP BY mi.name`,
            [restaurantId]
        );

        // Total menu items
        const menuCount = await query('SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = $1', [restaurantId]);

        // Build trend helpers
        const buildTrendDirection = (rows) => {
            const increasing = [];
            const decreasing = [];
            for (const r of rows) {
                const f = parseInt(r.first_half) || 0;
                const s = parseInt(r.second_half) || 0;
                if (s > f) increasing.push(r.name);
                else if (s < f) decreasing.push(r.name);
            }
            return { increasing, decreasing };
        };

        const weekTrends = buildTrendDirection(weeklyHalfTrends.rows);
        const monthTrends = buildTrendDirection(monthlyHalfTrends.rows);

        const r = restaurant.rows[0];
        res.json({
            success: true,
            data: {
                restaurant: {
                    name: r.name,
                    totalOrders: r.total_orders,
                    totalRevenue: parseFloat(r.total_revenue),
                    avgRating: parseFloat(r.avg_rating)
                },
                today: {
                    orders: parseInt(todayOrders.rows[0].count),
                    revenue: parseFloat(todayOrders.rows[0].revenue),
                    profit: parseFloat(todayProfit.rows[0].profit)
                },
                thisWeek: {
                    orders: parseInt(weekOrders.rows[0].count),
                    revenue: parseFloat(weekOrders.rows[0].revenue),
                    profit: parseFloat(weekProfit.rows[0].profit)
                },
                thisMonth: {
                    orders: parseInt(monthOrders.rows[0].count),
                    revenue: parseFloat(monthOrders.rows[0].revenue),
                    profit: parseFloat(monthProfit.rows[0].profit)
                },
                menuItemCount: parseInt(menuCount.rows[0].count),
                weeklyItemTrends: weeklyItemTrends.rows.map(r => ({ name: r.name, date: r.sale_date, qty: parseInt(r.qty) })),
                monthlyItemTrends: monthlyItemTrends.rows.map(r => ({ name: r.name, date: r.sale_date, qty: parseInt(r.qty) })),
                weeklyAnalysis: {
                    topItems: weeklyTopItems.rows.map(r => ({ name: r.name, qty: parseInt(r.total_qty) })),
                    ...weekTrends
                },
                monthlyAnalysis: {
                    topItems: monthlyTopItems.rows.map(r => ({ name: r.name, qty: parseInt(r.total_qty) })),
                    ...monthTrends
                },
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get dashboard' } });
    }
});

// ================== CONTRIBUTION MARGIN ANALYSIS ==================
router.get('/margins/:restaurantId', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;

        const items = await query(
            `SELECT mi.*, mc.name as category_name,
                    COALESCE(oi_agg.actual_sales, 0) as actual_sales,
                    COALESCE(oi_agg.actual_revenue, 0) as actual_revenue
             FROM menu_items mi
             LEFT JOIN menu_categories mc ON mi.category_id = mc.id
             LEFT JOIN (
                SELECT oi.menu_item_id,
                       SUM(oi.quantity) as actual_sales,
                       SUM(oi.total_price) as actual_revenue
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.restaurant_id = $1 AND o.status != 'cancelled'
                GROUP BY oi.menu_item_id
             ) oi_agg ON mi.id = oi_agg.menu_item_id
             WHERE mi.restaurant_id = $1
             ORDER BY (mi.price - mi.cost_price) DESC`,
            [restaurantId]
        );

        const margins = items.rows.map(item => {
            const price = parseFloat(item.price);
            const costPrice = parseFloat(item.cost_price);
            const margin = price - costPrice;
            const totalSales = parseInt(item.actual_sales) || item.total_sales || 0;

            return {
                id: item.id,
                name: item.name,
                category: item.category_name,
                price,
                costPrice,
                contributionMargin: margin,
                marginPercentage: price > 0
                    ? ((margin / price) * 100).toFixed(1)
                    : 0,
                totalSales,
                totalProfit: margin * totalSales,
                classification: item.classification
            };
        });

        res.json({ success: true, data: margins });
    } catch (error) {
        console.error('Margins error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get margins' } });
    }
});

// ================== ORDER-LEVEL CONTRIBUTION MARGIN ==================
router.get('/order-margins/:restaurantId', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;

        // Verify ownership
        const ownership = await query('SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2', [restaurantId, req.user.id]);
        if (ownership.rows.length === 0) {
            return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your restaurant' } });
        }

        const orders = await query(
            `SELECT
                o.id as order_id,
                o.order_number,
                o.total as order_total,
                o.created_at,
                json_agg(json_build_object(
                    'name', mi.name,
                    'qty', oi.quantity,
                    'unitPrice', oi.unit_price,
                    'costPrice', mi.cost_price,
                    'lineTotal', oi.total_price,
                    'lineCost', mi.cost_price * oi.quantity
                )) as items,
                SUM(oi.total_price) as selling_total,
                SUM(mi.cost_price * oi.quantity) as cost_total
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1 AND o.status != 'cancelled'
             GROUP BY o.id, o.order_number, o.total, o.created_at
             ORDER BY o.created_at DESC
             LIMIT 100`,
            [restaurantId]
        );

        const data = orders.rows.map(row => {
            const sellingTotal = parseFloat(row.selling_total) || 0;
            const costTotal = parseFloat(row.cost_total) || 0;
            const profit = sellingTotal - costTotal;
            return {
                orderId: row.order_id,
                orderNumber: row.order_number,
                createdAt: row.created_at,
                items: row.items.map(i => ({
                    name: i.name,
                    qty: i.qty,
                    unitPrice: parseFloat(i.unitPrice),
                    costPrice: parseFloat(i.costPrice),
                })),
                sellingTotal: parseFloat(sellingTotal.toFixed(2)),
                costTotal: parseFloat(costTotal.toFixed(2)),
                profit: parseFloat(profit.toFixed(2)),
            };
        });

        // Summary
        const totalProfit = data.reduce((s, o) => s + o.profit, 0);
        const totalRevenue = data.reduce((s, o) => s + o.sellingTotal, 0);
        const avgProfitPerOrder = data.length > 0 ? totalProfit / data.length : 0;

        res.json({
            success: true,
            data: {
                orders: data,
                summary: {
                    totalOrders: data.length,
                    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
                    totalProfit: parseFloat(totalProfit.toFixed(2)),
                    avgProfitPerOrder: parseFloat(avgProfitPerOrder.toFixed(2)),
                },
            },
        });
    } catch (error) {
        console.error('Order margins error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get order margins' } });
    }
});

// ================== ITEM CLASSIFICATION (BCG MATRIX) ==================
router.get('/classification/:restaurantId', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;

        const items = await query(
            `SELECT id, name, price, cost_price, total_sales, total_revenue, classification, popularity_score
       FROM menu_items WHERE restaurant_id = $1
       ORDER BY classification, total_sales DESC`,
            [restaurantId]
        );

        const classified = {
            stars: [],
            workhorses: [],
            puzzles: [],
            dogs: [],
            unclassified: []
        };

        items.rows.forEach(item => {
            const formatted = {
                id: item.id,
                name: item.name,
                price: parseFloat(item.price),
                costPrice: parseFloat(item.cost_price),
                margin: parseFloat(item.price) - parseFloat(item.cost_price),
                totalSales: item.total_sales || 0,
                totalRevenue: parseFloat(item.total_revenue) || 0,
                popularityScore: parseFloat(item.popularity_score) || 0
            };

            const key = item.classification === 'star' ? 'stars' :
                item.classification === 'workhorse' ? 'workhorses' :
                    item.classification === 'puzzle' ? 'puzzles' :
                        item.classification === 'dog' ? 'dogs' : 'unclassified';
            classified[key].push(formatted);
        });

        res.json({ success: true, data: classified });
    } catch (error) {
        console.error('Classification error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get classifications' } });
    }
});

// ================== HIDDEN STARS DETECTION ==================
router.get('/hidden-stars/:restaurantId', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;

        const items = await query(
            `SELECT mi.id, mi.name, mi.price, mi.cost_price, mi.classification,
                    COALESCE(oi_agg.actual_sales, 0) as actual_sales
             FROM menu_items mi
             LEFT JOIN (
                SELECT oi.menu_item_id, SUM(oi.quantity) as actual_sales
                FROM order_items oi
                JOIN orders o ON oi.order_id = o.id
                WHERE o.restaurant_id = $1 AND o.status != 'cancelled'
                GROUP BY oi.menu_item_id
             ) oi_agg ON mi.id = oi_agg.menu_item_id
             WHERE mi.restaurant_id = $1`,
            [restaurantId]
        );

        if (items.rows.length === 0) {
            return res.json({ success: true, data: { hiddenStars: [], avgSales: 0, avgMargin: 0, aiRecommendations: null } });
        }

        const itemsWithSales = items.rows.map(i => ({
            ...i,
            total_sales: parseInt(i.actual_sales) || i.total_sales || 0
        }));

        const avgSales = itemsWithSales.reduce((sum, i) => sum + i.total_sales, 0) / itemsWithSales.length;
        const avgMargin = itemsWithSales.reduce((sum, i) => sum + (parseFloat(i.price) - parseFloat(i.cost_price)), 0) / itemsWithSales.length;

        // Hidden stars: high margin but low sales
        const hiddenStars = itemsWithSales
            .filter(item => {
                const margin = parseFloat(item.price) - parseFloat(item.cost_price);
                return margin >= avgMargin && item.total_sales < avgSales;
            })
            .map(item => ({
                id: item.id,
                name: item.name,
                price: parseFloat(item.price),
                costPrice: parseFloat(item.cost_price),
                margin: parseFloat(item.price) - parseFloat(item.cost_price),
                marginPercentage: (((parseFloat(item.price) - parseFloat(item.cost_price)) / parseFloat(item.price)) * 100).toFixed(1),
                totalSales: item.total_sales,
                potential: 'High margin item with low visibility — promote this item!'
            }));

        // Get AI recommendations for hidden stars
        let aiRecommendations = null;
        if (hiddenStars.length > 0) {
            try {
                const prompt = `You are a restaurant revenue optimization expert. Analyze these hidden star menu items (high profit margin but low sales) and provide specific actionable recommendations for each item to increase sales:

${JSON.stringify(hiddenStars, null, 2)}

For each item, provide:
1. Why this item might have low sales
2. Specific promotion strategies
3. Menu placement suggestions
4. Upsell pairing suggestions

Return JSON array with format:
[{
  "itemName": "...",
  "analysis": "...",
  "strategies": ["strategy1", "strategy2"],
  "pairWith": ["item1", "item2"],
  "expectedImpact": "..."
}]`;

                aiRecommendations = await generateJSON(prompt);
            } catch (err) {
                console.error('AI recommendations error:', err);
            }
        }

        res.json({
            success: true,
            data: {
                hiddenStars,
                avgSales: avgSales.toFixed(1),
                avgMargin: avgMargin.toFixed(2),
                aiRecommendations
            }
        });
    } catch (error) {
        console.error('Hidden stars error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get hidden stars' } });
    }
});

// ================== COMBO RECOMMENDATIONS ==================
router.get('/combo-suggestions/:restaurantId', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;

        // Get co-purchase data
        const coPurchases = await query(
            `SELECT cp.*, 
        a.name as item_a_name, a.price as item_a_price,
        b.name as item_b_name, b.price as item_b_price
       FROM item_co_purchases cp
       JOIN menu_items a ON cp.item_a_id = a.id
       JOIN menu_items b ON cp.item_b_id = b.id
       WHERE cp.restaurant_id = $1
       ORDER BY cp.co_purchase_count DESC
       LIMIT 20`,
            [restaurantId]
        );

        // Get all items for AI analysis
        const menuItems = await query(
            'SELECT name, price, cost_price, total_sales, classification FROM menu_items WHERE restaurant_id = $1',
            [restaurantId]
        );

        let aiComboSuggestions = null;
        if (menuItems.rows.length >= 2) {
            try {
                const prompt = `You are a restaurant menu optimization expert. Based on this menu data and co-purchase patterns, suggest 3-5 combo deals that would maximize revenue:

Menu Items:
${JSON.stringify(menuItems.rows, null, 2)}

Co-purchase patterns (items frequently bought together):
${JSON.stringify(coPurchases.rows.map(cp => ({
                    items: [cp.item_a_name, cp.item_b_name],
                    frequency: cp.co_purchase_count
                })), null, 2)}

For each suggested combo, provide:
1. Combo name (creative and appealing)
2. Items included
3. Suggested combo price (should give 10-20% discount)
4. Why this combo works
5. Expected margin

Return JSON array:
[{
  "comboName": "...",
  "items": ["item1", "item2"],
  "suggestedPrice": 0.00,
  "originalPrice": 0.00,
  "discount": "15%",
  "reasoning": "...",
  "expectedMargin": "..."
}]`;

                aiComboSuggestions = await generateJSON(prompt);
            } catch (err) {
                console.error('AI combo suggestions error:', err);
            }
        }

        res.json({
            success: true,
            data: {
                coPurchasePatterns: coPurchases.rows.map(cp => ({
                    items: [cp.item_a_name, cp.item_b_name],
                    frequency: cp.co_purchase_count,
                    totalPrice: parseFloat(cp.item_a_price) + parseFloat(cp.item_b_price)
                })),
                aiComboSuggestions
            }
        });
    } catch (error) {
        console.error('Combo suggestions error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get combo suggestions' } });
    }
});

// ================== PRICE OPTIMIZATION ==================
router.get('/price-optimization/:restaurantId', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;

        const items = await query(
            `SELECT id, name, price, cost_price, total_sales, total_revenue, classification, popularity_score
       FROM menu_items WHERE restaurant_id = $1
       ORDER BY name`,
            [restaurantId]
        );

        if (items.rows.length === 0) {
            return res.json({ success: true, data: { suggestions: [], aiAnalysis: null } });
        }

        // Generate AI-powered price suggestions
        let aiAnalysis = null;
        try {
            const prompt = `You are a restaurant pricing strategist. Analyze these menu items and suggest price optimizations to maximize revenue:

${JSON.stringify(items.rows.map(i => ({
                name: i.name,
                price: parseFloat(i.price),
                costPrice: parseFloat(i.cost_price),
                margin: parseFloat(i.price) - parseFloat(i.cost_price),
                marginPercent: ((parseFloat(i.price) - parseFloat(i.cost_price)) / parseFloat(i.price) * 100).toFixed(1) + '%',
                totalSales: i.total_sales || 0,
                classification: i.classification,
                popularityScore: parseFloat(i.popularity_score) || 0
            })), null, 2)}

For each item that needs price adjustment, provide:
1. Current price
2. Suggested new price
3. Action: "increase", "decrease", "promote", or "keep"
4. Reasoning
5. Expected revenue impact

Return JSON array:
[{
  "itemName": "...",
  "currentPrice": 0.00,
  "suggestedPrice": 0.00,
  "action": "increase|decrease|promote|keep",
  "reasoning": "...",
  "expectedImpact": "..."
}]`;

            aiAnalysis = await generateJSON(prompt);
        } catch (err) {
            console.error('AI price analysis error:', err);
        }

        res.json({
            success: true,
            data: {
                items: items.rows.map(i => ({
                    id: i.id,
                    name: i.name,
                    price: parseFloat(i.price),
                    costPrice: parseFloat(i.cost_price),
                    margin: parseFloat(i.price) - parseFloat(i.cost_price),
                    totalSales: i.total_sales || 0,
                    classification: i.classification
                })),
                aiAnalysis
            }
        });
    } catch (error) {
        console.error('Price optimization error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get price optimization' } });
    }
});

// ================== SALES TRENDS ==================
router.get('/sales-trends/:restaurantId', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const { days } = req.query;
        const lookback = parseInt(days) || 30;

        // Daily trends from orders table directly
        const dailyTrends = await query(
            `SELECT DATE(o.created_at) as sale_date,
                    SUM(oi.quantity) as total_quantity,
                    SUM(oi.total_price) as total_revenue,
                    SUM(oi.total_price - (mi.cost_price * oi.quantity)) as total_profit
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1
               AND o.status != 'cancelled'
               AND o.created_at >= CURRENT_DATE - $2::integer
             GROUP BY DATE(o.created_at)
             ORDER BY sale_date ASC`,
            [restaurantId, lookback]
        );

        // Per-item trends from orders table directly
        const itemTrends = await query(
            `SELECT mi.name,
                    SUM(oi.quantity) as total_sold,
                    SUM(oi.total_price) as total_revenue,
                    SUM(oi.total_price - (mi.cost_price * oi.quantity)) as total_profit
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1
               AND o.status != 'cancelled'
               AND o.created_at >= CURRENT_DATE - $2::integer
             GROUP BY mi.name
             ORDER BY total_sold DESC
             LIMIT 10`,
            [restaurantId, lookback]
        );

        // Per-item first-half vs second-half trends for popularity direction
        const halfPoint = Math.floor(lookback / 2);
        const itemHalfTrends = await query(
            `SELECT mi.id, mi.name,
                    SUM(CASE WHEN o.created_at >= CURRENT_DATE - $2::integer AND o.created_at < CURRENT_DATE - $3::integer THEN oi.quantity ELSE 0 END) as first_half_sales,
                    SUM(CASE WHEN o.created_at >= CURRENT_DATE - $3::integer THEN oi.quantity ELSE 0 END) as second_half_sales
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE o.restaurant_id = $1
               AND o.status != 'cancelled'
               AND o.created_at >= CURRENT_DATE - $2::integer
             GROUP BY mi.id, mi.name`,
            [restaurantId, lookback, halfPoint]
        );

        res.json({
            success: true,
            data: {
                dailyTrends: dailyTrends.rows.map(d => ({
                    date: d.sale_date,
                    quantity: parseInt(d.total_quantity) || 0,
                    revenue: parseFloat(d.total_revenue) || 0,
                    profit: parseFloat(d.total_profit) || 0
                })),
                itemTrends: itemTrends.rows.map(i => ({
                    name: i.name,
                    totalSold: parseInt(i.total_sold) || 0,
                    totalRevenue: parseFloat(i.total_revenue) || 0,
                    totalProfit: parseFloat(i.total_profit) || 0
                })),
                itemHalfTrends: itemHalfTrends.rows.map(i => ({
                    id: i.id,
                    name: i.name,
                    firstHalf: parseInt(i.first_half_sales) || 0,
                    secondHalf: parseInt(i.second_half_sales) || 0,
                }))
            }
        });
    } catch (error) {
        console.error('Sales trends error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get sales trends' } });
    }
});

module.exports = router;
