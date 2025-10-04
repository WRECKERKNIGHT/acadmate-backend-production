import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Send notifications (HEAD_TEACHER only)
router.post('/send', authenticateToken, requireRole('HEAD_TEACHER'), async (req, res) => {
  try {
    const {
      title,
      message,
      type = 'INFO',
      recipients,
      actionUrl
    } = req.body;
    
    if (!title || !message || !recipients) {
      return res.status(400).json({ error: 'Missing required fields: title, message, recipients' });
    }
    
    if (!['INFO', 'SUCCESS', 'WARNING', 'ERROR'].includes(type)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }
    
    let userIds: string[] = [];
    
    // Handle different recipient types
    switch (recipients.type) {
      case 'all':
        const allUsers = await prisma.user.findMany({
          where: { isActive: true },
          select: { id: true }
        });
        userIds = allUsers.map(u => u.id);
        break;
        
      case 'students':
        const students = await prisma.user.findMany({
          where: { role: 'STUDENT', isActive: true },
          select: { id: true }
        });
        userIds = students.map(u => u.id);
        break;
        
      case 'teachers':
        const teachers = await prisma.user.findMany({
          where: { role: 'TEACHER', isActive: true },
          select: { id: true }
        });
        userIds = teachers.map(u => u.id);
        break;
        
      case 'batch':
        if (!recipients.batchType) {
          return res.status(400).json({ error: 'Batch type is required for batch notifications' });
        }
        const batchUsers = await prisma.user.findMany({
          where: { 
            batchType: recipients.batchType,
            isActive: true
          },
          select: { id: true }
        });
        userIds = batchUsers.map(u => u.id);
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid recipient type' });
    }
    
    if (userIds.length === 0) {
      return res.status(400).json({ error: 'No valid recipients found' });
    }
    
    // Create notifications for all recipients
    const notifications = await prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        title,
        message,
        type,
        actionUrl: actionUrl || null
      }))
    });
    
    res.status(201).json({
      success: true,
      message: `Notification sent to ${notifications.count} recipients`,
      count: notifications.count
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Get all notifications for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { isRead } = req.query;
    
    let whereCondition: any = { userId };
    
    if (isRead !== undefined) {
      whereCondition.isRead = isRead === 'true';
    }
    
    const notifications = await prisma.notification.findMany({
      where: whereCondition,
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to 50 most recent notifications
    });
    
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread notifications count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });
    
    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    
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
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false
      },
      data: { isRead: true }
    });
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    
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
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete all read notifications
router.delete('/read/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    await prisma.notification.deleteMany({
      where: {
        userId,
        isRead: true
      }
    });
    
    res.json({ message: 'All read notifications deleted successfully' });
  } catch (error) {
    console.error('Delete all read notifications error:', error);
    res.status(500).json({ error: 'Failed to delete read notifications' });
  }
});

export default router;

