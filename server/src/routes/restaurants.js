const express = require('express');
const { query } = require('../config/db');
const { authMiddleware, ownerMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create restaurant
router.post('/', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const { name, description, cuisineType, address, city, phone, email, openingTime, closingTime } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Restaurant name is required' }
            });
        }

        // Check if owner already has a restaurant
        const existing = await query('SELECT id FROM restaurants WHERE owner_id = $1', [req.user.id]);
        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: { code: 'CONFLICT', message: 'You already have a restaurant registered' }
            });
        }

        const result = await query(
            `INSERT INTO restaurants (owner_id, name, description, cuisine_type, address, city, phone, email, opening_time, closing_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
            [req.user.id, name, description || null, cuisineType || null, address || null, city || null, phone || null, email || null, openingTime || '09:00', closingTime || '23:00']
        );

        const restaurant = result.rows[0];
        res.status(201).json({
            success: true,
            data: formatRestaurant(restaurant)
        });
    } catch (error) {
        console.error('Create restaurant error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to create restaurant' }
        });
    }
});

// Get all restaurants (for customers)
router.get('/', async (req, res) => {
    try {
        const { search, cuisine, city } = req.query;
        let sql = 'SELECT * FROM restaurants WHERE is_active = true';
        const params = [];
        let paramIndex = 1;

        if (search) {
            sql += ` AND (LOWER(name) LIKE $${paramIndex} OR LOWER(description) LIKE $${paramIndex})`;
            params.push(`%${search.toLowerCase()}%`);
            paramIndex++;
        }

        if (cuisine) {
            sql += ` AND LOWER(cuisine_type) = $${paramIndex}`;
            params.push(cuisine.toLowerCase());
            paramIndex++;
        }

        if (city) {
            sql += ` AND LOWER(city) = $${paramIndex}`;
            params.push(city.toLowerCase());
            paramIndex++;
        }

        sql += ' ORDER BY avg_rating DESC, total_orders DESC';

        const result = await query(sql, params);
        res.json({
            success: true,
            data: result.rows.map(formatRestaurant)
        });
    } catch (error) {
        console.error('Get restaurants error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to get restaurants' }
        });
    }
});

// Get owner's restaurant
router.get('/my-restaurant', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const result = await query('SELECT * FROM restaurants WHERE owner_id = $1', [req.user.id]);

        if (result.rows.length === 0) {
            return res.json({ success: true, data: null });
        }

        res.json({
            success: true,
            data: formatRestaurant(result.rows[0])
        });
    } catch (error) {
        console.error('Get my restaurant error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to get restaurant' }
        });
    }
});

// Get single restaurant
router.get('/:id', async (req, res) => {
    try {
        const result = await query('SELECT * FROM restaurants WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Restaurant not found' }
            });
        }

        res.json({
            success: true,
            data: formatRestaurant(result.rows[0])
        });
    } catch (error) {
        console.error('Get restaurant error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to get restaurant' }
        });
    }
});

// Update restaurant
router.put('/:id', authMiddleware, ownerMiddleware, async (req, res) => {
    try {
        const { name, description, cuisineType, address, city, phone, email, openingTime, closingTime, isActive } = req.body;

        // Verify ownership
        const existing = await query('SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
        if (existing.rows.length === 0) {
            return res.status(403).json({
                success: false,
                error: { code: 'FORBIDDEN', message: 'You do not own this restaurant' }
            });
        }

        const result = await query(
            `UPDATE restaurants SET 
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        cuisine_type = COALESCE($3, cuisine_type),
        address = COALESCE($4, address),
        city = COALESCE($5, city),
        phone = COALESCE($6, phone),
        email = COALESCE($7, email),
        opening_time = COALESCE($8, opening_time),
        closing_time = COALESCE($9, closing_time),
        is_active = COALESCE($10, is_active)
       WHERE id = $11
       RETURNING *`,
            [name, description, cuisineType, address, city, phone, email, openingTime, closingTime, isActive, req.params.id]
        );

        res.json({
            success: true,
            data: formatRestaurant(result.rows[0])
        });
    } catch (error) {
        console.error('Update restaurant error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to update restaurant' }
        });
    }
});

function formatRestaurant(r) {
    return {
        id: r.id,
        ownerId: r.owner_id,
        name: r.name,
        description: r.description,
        cuisineType: r.cuisine_type,
        address: r.address,
        city: r.city,
        phone: r.phone,
        email: r.email,
        logoUrl: r.logo_url,
        coverImageUrl: r.cover_image_url,
        openingTime: r.opening_time,
        closingTime: r.closing_time,
        isActive: r.is_active,
        avgRating: parseFloat(r.avg_rating) || 0,
        totalOrders: r.total_orders || 0,
        totalRevenue: parseFloat(r.total_revenue) || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at
    };
}

module.exports = router;
