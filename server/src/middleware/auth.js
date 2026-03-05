const jwt = require('jsonwebtoken');
require('dotenv').config();

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'No token provided' }
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' }
        });
    }
};

const ownerMiddleware = (req, res, next) => {
    if (req.user.role !== 'owner') {
        return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Access denied. Restaurant owner only.' }
        });
    }
    next();
};

const customerMiddleware = (req, res, next) => {
    if (req.user.role !== 'customer') {
        return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Access denied. Customers only.' }
        });
    }
    next();
};

module.exports = { authMiddleware, ownerMiddleware, customerMiddleware };
