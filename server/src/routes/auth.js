const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, fullName, role, phone } = req.body;

        if (!email || !password || !fullName || !role) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'All fields are required' }
            });
        }

        if (!['customer', 'owner'].includes(role)) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Invalid role' }
            });
        }

        // Check if user exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: { code: 'CONFLICT', message: 'Email already registered' }
            });
        }

        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, role, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role, phone, created_at`,
            [email, passwordHash, fullName, role, phone || null]
        );

        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    phone: user.phone,
                },
                token
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Registration failed' }
        });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' }
            });
        }

        const result = await query(
            'SELECT id, email, password_hash, full_name, role, phone FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' }
            });
        }

        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' }
            });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    role: user.role,
                    phone: user.phone,
                },
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Login failed' }
        });
    }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const result = await query(
            'SELECT id, email, full_name, role, phone, preferred_language, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', message: 'User not found' }
            });
        }

        const user = result.rows[0];
        res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role,
                phone: user.phone,
                preferredLanguage: user.preferred_language,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to get user' }
        });
    }
});

module.exports = router;
