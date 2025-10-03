import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// Use the global Express Request interface augmentation
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).json({ error: 'Invalid token' });
    }
};
export const requireRole = (role) => {
    return (req, res, next) => {
        if (req.user?.role !== role) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
};
