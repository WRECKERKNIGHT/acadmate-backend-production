import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();
const prisma = new PrismaClient();
// Get all notifications for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const { isRead } = req.query;
        let whereCondition = { userId };
        if (isRead !== undefined) {
            whereCondition.isRead = isRead === 'true';
        }
        const notifications = await prisma.notification.findMany({
            where: whereCondition,
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to 50 most recent notifications
        });
        res.json(notifications);
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});
// Get unread notifications count
router.get('/unread-count', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        const count = await prisma.notification.count({
            where: {
                userId,
                isRead: false
            }
        });
        res.json({ count });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});
// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.user;
        const notification = await prisma.notification.findFirst({
            where: {
                id,
                userId
            }
        });
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        const updatedNotification = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json(updatedNotification);
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});
// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        await prisma.notification.updateMany({
            where: {
                userId,
                isRead: false
            },
            data: { isRead: true }
        });
        res.json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});
// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.user;
        const notification = await prisma.notification.findFirst({
            where: {
                id,
                userId
            }
        });
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        await prisma.notification.delete({
            where: { id }
        });
        res.json({ message: 'Notification deleted successfully' });
    }
    catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});
// Delete all read notifications
router.delete('/read/all', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.user;
        await prisma.notification.deleteMany({
            where: {
                userId,
                isRead: true
            }
        });
        res.json({ message: 'All read notifications deleted successfully' });
    }
    catch (error) {
        console.error('Delete all read notifications error:', error);
        res.status(500).json({ error: 'Failed to delete read notifications' });
    }
});
export default router;
