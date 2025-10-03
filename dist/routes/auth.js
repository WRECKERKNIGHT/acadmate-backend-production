import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// Registration disabled - only pre-approved users can login
router.post('/register', async (req, res) => {
    res.status(403).json({ error: 'Registration is disabled. Only admitted students and hired teachers can access Acadmate.' });
});
// Login with UID
router.post('/login', async (req, res) => {
    try {
        const { uid, password } = req.body;
        if (!uid || !password) {
            return res.status(400).json({ error: 'UID and password are required' });
        }
        // Find user by UID
        const user = await prisma.user.findUnique({
            where: { uid: uid.toUpperCase() } // Store UIDs in uppercase
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid credentials or account inactive' });
        }
        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
        });
        // Generate JWT
        const token = jwt.sign({ userId: user.id, uid: user.uid, role: user.role, batchType: user.batchType }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: {
                id: user.id,
                uid: user.uid,
                fullName: user.fullName,
                role: user.role,
                batchType: user.batchType,
                subjects: user.subjects
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});
export default router;
