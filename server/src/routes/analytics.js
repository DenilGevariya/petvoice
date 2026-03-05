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

        // Get restaurant stats
        const restaurant = await query('SELECT * FROM restaurants WHERE id = $1', [restaurantId]);

        // Today's stats
        const todayOrders = await query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue 
       FROM orders WHERE restaurant_id = $1 AND DATE(created_at) = CURRENT_DATE`,
            [restaurantId]
        );

        // This week's stats
        const weekOrders = await query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue 
       FROM orders WHERE restaurant_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '7 days'`,
            [restaurantId]
        );

        // This month's stats
        const monthOrders = await query(
            `SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue 
       FROM orders WHERE restaurant_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
            [restaurantId]
        );

        // Top selling items
        const topItems = await query(
            `SELECT name, total_sales, total_revenue, classification 
       FROM menu_items WHERE restaurant_id = $1 
       ORDER BY total_sales DESC LIMIT 5`,
            [restaurantId]
        );

        // Recent orders
        const recentOrders = await query(
            `SELECT o.order_number, o.total, o.status, o.created_at, u.full_name as customer_name
       FROM orders o JOIN users u ON o.user_id = u.id
       WHERE o.restaurant_id = $1 
       ORDER BY o.created_at DESC LIMIT 5`,
            [restaurantId]
        );

        // Classification distribution
        const classifications = await query(
            `SELECT classification, COUNT(*) as count 
       FROM menu_items WHERE restaurant_id = $1 AND classification != 'unclassified'
       GROUP BY classification`,
            [restaurantId]
        );

        // Total menu items
        const menuCount = await query(
            'SELECT COUNT(*) as count FROM menu_items WHERE restaurant_id = $1',
            [restaurantId]
        );

        // AI voice orders count
        const voiceOrders = await query(
            `SELECT COUNT(*) as count FROM orders WHERE restaurant_id = $1 AND ordered_via = 'voice'`,
            [restaurantId]
        );

        // Upsell acceptance rate
        const upsellStats = await query(
            `SELECT 
        COUNT(*) FILTER (WHERE ai_upsell_accepted = true) as accepted,
        COUNT(*) as total
       FROM orders WHERE restaurant_id = $1 AND ordered_via = 'voice'`,
            [restaurantId]
        );

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
                    revenue: parseFloat(todayOrders.rows[0].revenue)
                },
                thisWeek: {
                    orders: parseInt(weekOrders.rows[0].count),
                    revenue: parseFloat(weekOrders.rows[0].revenue)
                },
                thisMonth: {
                    orders: parseInt(monthOrders.rows[0].count),
                    revenue: parseFloat(monthOrders.rows[0].revenue)
                },
                topItems: topItems.rows.map(i => ({
                    name: i.name,
                    totalSales: i.total_sales,
                    totalRevenue: parseFloat(i.total_revenue),
                    classification: i.classification
                })),
                recentOrders: recentOrders.rows.map(o => ({
                    orderNumber: o.order_number,
                    total: parseFloat(o.total),
                    status: o.status,
                    customerName: o.customer_name,
                    createdAt: o.created_at
                })),
                classifications: classifications.rows.reduce((acc, c) => {
                    acc[c.classification] = parseInt(c.count);
                    return acc;
                }, {}),
                menuItemCount: parseInt(menuCount.rows[0].count),
                voiceOrderCount: parseInt(voiceOrders.rows[0].count),
                upsellRate: upsellStats.rows[0].total > 0
                    ? ((parseInt(upsellStats.rows[0].accepted) / parseInt(upsellStats.rows[0].total)) * 100).toFixed(1)
                    : 0
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
            `SELECT mi.*, mc.name as category_name
       FROM menu_items mi
       LEFT JOIN menu_categories mc ON mi.category_id = mc.id
       WHERE mi.restaurant_id = $1
       ORDER BY (mi.price - mi.cost_price) DESC`,
            [restaurantId]
        );

        const margins = items.rows.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category_name,
            price: parseFloat(item.price),
            costPrice: parseFloat(item.cost_price),
            contributionMargin: parseFloat(item.price) - parseFloat(item.cost_price),
            marginPercentage: parseFloat(item.price) > 0
                ? (((parseFloat(item.price) - parseFloat(item.cost_price)) / parseFloat(item.price)) * 100).toFixed(1)
                : 0,
            totalSales: item.total_sales || 0,
            totalProfit: (parseFloat(item.price) - parseFloat(item.cost_price)) * (item.total_sales || 0),
            classification: item.classification
        }));

        res.json({ success: true, data: margins });
    } catch (error) {
        console.error('Margins error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get margins' } });
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
            `SELECT id, name, price, cost_price, total_sales, total_revenue, classification
       FROM menu_items WHERE restaurant_id = $1`,
            [restaurantId]
        );

        if (items.rows.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const avgSales = items.rows.reduce((sum, i) => sum + (i.total_sales || 0), 0) / items.rows.length;
        const avgMargin = items.rows.reduce((sum, i) => sum + (parseFloat(i.price) - parseFloat(i.cost_price)), 0) / items.rows.length;

        // Hidden stars: high margin but low sales (classification = 'puzzle')
        const hiddenStars = items.rows
            .filter(item => {
                const margin = parseFloat(item.price) - parseFloat(item.cost_price);
                return margin >= avgMargin && (item.total_sales || 0) < avgSales;
            })
            .map(item => ({
                id: item.id,
                name: item.name,
                price: parseFloat(item.price),
                costPrice: parseFloat(item.cost_price),
                margin: parseFloat(item.price) - parseFloat(item.cost_price),
                marginPercentage: (((parseFloat(item.price) - parseFloat(item.cost_price)) / parseFloat(item.price)) * 100).toFixed(1),
                totalSales: item.total_sales || 0,
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

        const dailyTrends = await query(
            `SELECT sale_date, SUM(quantity_sold) as total_quantity, SUM(revenue) as total_revenue, SUM(profit) as total_profit
       FROM daily_sales 
       WHERE restaurant_id = $1 AND sale_date >= CURRENT_DATE - $2::integer
       GROUP BY sale_date
       ORDER BY sale_date ASC`,
            [restaurantId, lookback]
        );

        const itemTrends = await query(
            `SELECT mi.name, SUM(ds.quantity_sold) as total_sold, SUM(ds.revenue) as total_revenue, SUM(ds.profit) as total_profit
       FROM daily_sales ds
       JOIN menu_items mi ON ds.menu_item_id = mi.id
       WHERE ds.restaurant_id = $1 AND ds.sale_date >= CURRENT_DATE - $2::integer
       GROUP BY mi.name
       ORDER BY total_sold DESC
       LIMIT 10`,
            [restaurantId, lookback]
        );

        res.json({
            success: true,
            data: {
                dailyTrends: dailyTrends.rows.map(d => ({
                    date: d.sale_date,
                    quantity: parseInt(d.total_quantity),
                    revenue: parseFloat(d.total_revenue),
                    profit: parseFloat(d.total_profit)
                })),
                itemTrends: itemTrends.rows.map(i => ({
                    name: i.name,
                    totalSold: parseInt(i.total_sold),
                    totalRevenue: parseFloat(i.total_revenue),
                    totalProfit: parseFloat(i.total_profit)
                }))
            }
        });
    } catch (error) {
        console.error('Sales trends error:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get sales trends' } });
    }
});

module.exports = router;
