import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Get all events (filtered by user role and batch)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, batchType, uid } = req.user!;
    
    let events;
    
    if (role === 'HEAD_TEACHER') {
      // Head teachers can see all events
      events = await prisma.specialEvent.findMany({
        include: {
          batches: true,
          participants: {
            include: {
              user: {
                select: {
                  uid: true,
                  fullName: true,
                  role: true,
                  batchType: true
                }
              }
            }
          }
        },
        orderBy: { scheduledAt: 'asc' }
      });
    } else if (role === 'TEACHER') {
      // Teachers see events for their batches and events they're invited to
      const teacher = await prisma.user.findUnique({
        where: { uid },
        include: { batchesTeaching: true }
      });
      
      const teacherBatches = teacher?.batchesTeaching || [];
      const batchIds = teacherBatches.map(b => b.id);
      
      events = await prisma.specialEvent.findMany({
        where: {
          OR: [
            { batches: { some: { id: { in: batchIds } } } },
            { participants: { some: { userUid: uid } } }
          ]
        },
        include: {
          batches: true,
          participants: {
            include: {
              user: {
                select: {
                  uid: true,
                  fullName: true,
                  role: true,
                  batchType: true
                }
              }
            }
          }
        },
        orderBy: { scheduledAt: 'asc' }
      });
    } else {
      // Students see events for their batch and events they're invited to
      events = await prisma.specialEvent.findMany({
        where: {
          OR: [
            { batches: { some: { type: batchType } } },
            { participants: { some: { userUid: uid } } }
          ]
        },
        include: {
          batches: true,
          participants: {
            include: {
              user: {
                select: {
                  uid: true,
                  fullName: true,
                  role: true,
                  batchType: true
                }
              }
            }
          }
        },
        orderBy: { scheduledAt: 'asc' }
      });
    }
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

// Get single event by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, uid } = req.user!;
    
    const event = await prisma.specialEvent.findUnique({
      where: { id },
      include: {
        batches: true,
        participants: {
          include: {
            user: {
              select: {
                uid: true,
                fullName: true,
                role: true,
                batchType: true
              }
            }
          }
        }
      }
    });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user has access to this event
    const hasAccess = role === 'HEAD_TEACHER' || 
                      event.participants.some(p => p.userUid === uid) ||
                      (role === 'STUDENT' && event.batches.some(b => b.type === req.user?.batchType)) ||
                      (role === 'TEACHER' && await checkTeacherBatchAccess(uid, event.batches.map(b => b.id)));
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this event' });
    }
    
    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ message: 'Failed to fetch event' });
  }
});

// Create new event (HEAD_TEACHER only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user!;
    
    if (role !== 'HEAD_TEACHER') {
      return res.status(403).json({ message: 'Only head teachers can create events' });
    }
    
    const { 
      title, 
      description, 
      type, 
      scheduledAt, 
      duration, 
      location, 
      batchIds, 
      participantUids,
      maxParticipants,
      isRecurring,
      recurringPattern
    } = req.body;
    
    // Validate required fields
    if (!title || !type || !scheduledAt) {
      return res.status(400).json({ message: 'Title, type, and scheduled time are required' });
    }
    
    // Create the event
    const event = await prisma.specialEvent.create({
      data: {
        title,
        description,
        type,
        scheduledAt: new Date(scheduledAt),
        duration: duration || 60,
        location,
        maxParticipants,
        isRecurring: isRecurring || false,
        recurringPattern,
        batches: batchIds ? {
          connect: batchIds.map((id: string) => ({ id }))
        } : undefined,
        participants: participantUids ? {
          create: participantUids.map((uid: string) => ({
            userUid: uid,
            status: 'INVITED'
          }))
        } : undefined
      },
      include: {
        batches: true,
        participants: {
          include: {
            user: {
              select: {
                uid: true,
                fullName: true,
                role: true,
                batchType: true
              }
            }
          }
        }
      }
    });
    
    // Send notifications to participants
    await sendEventNotifications(event, 'created');
    
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Failed to create event' });
  }
});

// Update event (HEAD_TEACHER only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user!;
    const { id } = req.params;
    
    if (role !== 'HEAD_TEACHER') {
      return res.status(403).json({ message: 'Only head teachers can update events' });
    }
    
    const { 
      title, 
      description, 
      scheduledAt, 
      duration, 
      location, 
      batchIds, 
      participantUids,
      maxParticipants,
      status
    } = req.body;
    
    // First, clear existing connections
    if (batchIds) {
      await prisma.specialEvent.update({
        where: { id },
        data: {
          batches: { set: [] }
        }
      });
    }
    
    if (participantUids) {
      await prisma.eventParticipant.deleteMany({
        where: { eventId: id }
      });
    }
    
    // Update the event
    const event = await prisma.specialEvent.update({
      where: { id },
      data: {
        title,
        description,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        duration,
        location,
        maxParticipants,
        status,
        batches: batchIds ? {
          connect: batchIds.map((batchId: string) => ({ id: batchId }))
        } : undefined,
        participants: participantUids ? {
          create: participantUids.map((uid: string) => ({
            userUid: uid,
            status: 'INVITED'
          }))
        } : undefined
      },
      include: {
        batches: true,
        participants: {
          include: {
            user: {
              select: {
                uid: true,
                fullName: true,
                role: true,
                batchType: true
              }
            }
          }
        }
      }
    });
    
    // Send notifications about the update
    await sendEventNotifications(event, 'updated');
    
    res.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: 'Failed to update event' });
  }
});

// Delete event (HEAD_TEACHER only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { role } = req.user!;
    const { id } = req.params;
    
    if (role !== 'HEAD_TEACHER') {
      return res.status(403).json({ message: 'Only head teachers can delete events' });
    }
    
    const event = await prisma.specialEvent.findUnique({
      where: { id },
      include: { participants: true }
    });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Delete all participants first
    await prisma.eventParticipant.deleteMany({
      where: { eventId: id }
    });
    
    // Delete the event
    await prisma.specialEvent.delete({
      where: { id }
    });
    
    // Send cancellation notifications
    await sendEventNotifications(event, 'cancelled');
    
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Failed to delete event' });
  }
});

// RSVP to event
router.post('/:id/rsvp', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { uid } = req.user!;
    const { status } = req.body; // 'ATTENDING', 'NOT_ATTENDING', 'MAYBE'
    
    if (!['ATTENDING', 'NOT_ATTENDING', 'MAYBE'].includes(status)) {
      return res.status(400).json({ message: 'Invalid RSVP status' });
    }
    
    const event = await prisma.specialEvent.findUnique({
      where: { id },
      include: { participants: true }
    });
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if event is at capacity
    if (event.maxParticipants && status === 'ATTENDING') {
      const attendingCount = event.participants.filter(p => p.status === 'ATTENDING').length;
      if (attendingCount >= event.maxParticipants) {
        return res.status(400).json({ message: 'Event is at maximum capacity' });
      }
    }
    
    // Update or create participant record
    const participant = await prisma.eventParticipant.upsert({
      where: {
        eventId_userUid: {
          eventId: id,
          userUid: uid
        }
      },
      update: {
        status,
        respondedAt: new Date()
      },
      create: {
        eventId: id,
        userUid: uid,
        status,
        respondedAt: new Date()
      },
      include: {
        user: {
          select: {
            uid: true,
            fullName: true,
            role: true,
            batchType: true
          }
        }
      }
    });
    
    res.json(participant);
  } catch (error) {
    console.error('Error updating RSVP:', error);
    res.status(500).json({ message: 'Failed to update RSVP' });
  }
});

// Get event types and statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const { role, batchType, uid } = req.user!;
    
    let whereClause = {};
    
    if (role === 'STUDENT') {
      whereClause = {
        OR: [
          { batches: { some: { type: batchType } } },
          { participants: { some: { userUid: uid } } }
        ]
      };
    } else if (role === 'TEACHER') {
      const teacher = await prisma.user.findUnique({
        where: { uid },
        include: { batchesTeaching: true }
      });
      const batchIds = teacher?.batchesTeaching?.map(b => b.id) || [];
      
      whereClause = {
        OR: [
          { batches: { some: { id: { in: batchIds } } } },
          { participants: { some: { userUid: uid } } }
        ]
      };
    }
    
    const stats = await prisma.specialEvent.groupBy({
      by: ['type'],
      where: whereClause,
      _count: true
    });
    
    const upcomingEvents = await prisma.specialEvent.count({
      where: {
        ...whereClause,
        scheduledAt: { gte: new Date() },
        status: 'SCHEDULED'
      }
    });
    
    const totalEvents = await prisma.specialEvent.count({
      where: whereClause
    });
    
    res.json({
      totalEvents,
      upcomingEvents,
      eventsByType: stats
    });
  } catch (error) {
    console.error('Error fetching event stats:', error);
    res.status(500).json({ message: 'Failed to fetch event statistics' });
  }
});

// Helper function to check teacher batch access
async function checkTeacherBatchAccess(teacherUid: string, batchIds: string[]): Promise<boolean> {
  const teacher = await prisma.user.findUnique({
    where: { uid: teacherUid },
    include: { batchesTeaching: true }
  });
  
  if (!teacher) return false;
  
  const teacherBatchIds = teacher.batchesTeaching.map(b => b.id);
  return batchIds.some(id => teacherBatchIds.includes(id));
}

// Helper function to send notifications
async function sendEventNotifications(event: any, action: 'created' | 'updated' | 'cancelled') {
  // This would integrate with your notification system
  console.log(`Event ${action}: ${event.title} at ${event.scheduledAt}`);
  // TODO: Implement actual notification sending (email, push notifications, etc.)
}

export default router;

