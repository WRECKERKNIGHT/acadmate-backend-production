import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Get all scheduled classes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { date, batchType, teacherId } = req.query;
    
    const where: any = {
      isActive: true
    };
    
    if (date) {
      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      where.date = {
        gte: startDate,
        lt: endDate
      };
    }
    
    if (batchType) {
      where.batchType = batchType;
    }
    
    if (teacherId) {
      where.teacherId = teacherId;
    }
    
    const classes = await prisma.classSchedule.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            uid: true,
            fullName: true,
            subjects: true
          }
        },
        creator: {
          select: {
            id: true,
            uid: true,
            fullName: true
          }
        },
        attendance: {
          include: {
            student: {
              select: {
                id: true,
                uid: true,
                fullName: true
              }
            }
          }
        }
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    });
    
    res.json({ success: true, classes });
  } catch (error) {
    console.error('Error fetching scheduled classes:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled classes' });
  }
});

// Create a new scheduled class (HEAD_TEACHER only)
router.post('/', authenticateToken, requireRole('HEAD_TEACHER'), async (req, res) => {
  try {
    const {
      subject,
      teacherId,
      batchType,
      roomNumber,
      date,
      startTime,
      endTime,
      topic,
      description
    } = req.body;
    
    // Validate required fields
    if (!subject || !teacherId || !batchType || !roomNumber || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if teacher exists
    const teacher = await prisma.user.findUnique({
      where: { id: teacherId },
      select: { id: true, role: true, isActive: true }
    });
    
    if (!teacher || teacher.role !== 'TEACHER' || !teacher.isActive) {
      return res.status(400).json({ error: 'Invalid teacher selected' });
    }
    
    // Check for time conflicts
    const conflictingClasses = await prisma.classSchedule.findMany({
      where: {
        date: new Date(date),
        isActive: true,
        OR: [
          { teacherId: teacherId },
          { roomNumber: roomNumber }
        ],
        AND: [
          {
            OR: [
              {
                AND: [
                  { startTime: { lte: startTime } },
                  { endTime: { gt: startTime } }
                ]
              },
              {
                AND: [
                  { startTime: { lt: endTime } },
                  { endTime: { gte: endTime } }
                ]
              },
              {
                AND: [
                  { startTime: { gte: startTime } },
                  { endTime: { lte: endTime } }
                ]
              }
            ]
          }
        ]
      }
    });
    
    if (conflictingClasses.length > 0) {
      return res.status(400).json({ 
        error: 'Time conflict detected with existing class or room booking' 
      });
    }
    
    const scheduledClass = await prisma.classSchedule.create({
      data: {
        subject,
        teacherId,
        creatorId: req.user!.userId,
        batchType,
        roomNumber,
        date: new Date(date),
        startTime,
        endTime,
        topic: topic || null,
        description: description || null
      },
      include: {
        teacher: {
          select: {
            id: true,
            uid: true,
            fullName: true,
            subjects: true
          }
        },
        creator: {
          select: {
            id: true,
            uid: true,
            fullName: true
          }
        }
      }
    });
    
    // Create notification for the teacher
    await prisma.notification.create({
      data: {
        userId: teacherId,
        title: 'New Class Scheduled',
        message: `You have been assigned a ${subject} class for ${batchType} on ${date} from ${startTime} to ${endTime} in ${roomNumber}.`,
        type: 'INFO'
      }
    });
    
    // Create notifications for students in the batch
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        batchType: batchType as any,
        isActive: true
      },
      select: { id: true }
    });
    
    if (students.length > 0) {
      await prisma.notification.createMany({
        data: students.map(student => ({
          userId: student.id,
          title: 'New Class Scheduled',
          message: `${subject} class scheduled for ${date} from ${startTime} to ${endTime} in ${roomNumber}.`,
          type: 'INFO'
        }))
      });
    }
    
    res.status(201).json({ success: true, class: scheduledClass });
  } catch (error) {
    console.error('Error creating scheduled class:', error);
    res.status(500).json({ error: 'Failed to create scheduled class' });
  }
});

// Update a scheduled class (HEAD_TEACHER only)
router.put('/:id', authenticateToken, requireRole('HEAD_TEACHER'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      subject,
      teacherId,
      batchType,
      roomNumber,
      date,
      startTime,
      endTime,
      topic,
      description
    } = req.body;
    
    const existingClass = await prisma.classSchedule.findUnique({
      where: { id },
      include: { teacher: true }
    });
    
    if (!existingClass) {
      return res.status(404).json({ error: 'Scheduled class not found' });
    }
    
    const updatedClass = await prisma.classSchedule.update({
      where: { id },
      data: {
        subject: subject || existingClass.subject,
        teacherId: teacherId || existingClass.teacherId,
        batchType: batchType || existingClass.batchType,
        roomNumber: roomNumber || existingClass.roomNumber,
        date: date ? new Date(date) : existingClass.date,
        startTime: startTime || existingClass.startTime,
        endTime: endTime || existingClass.endTime,
        topic: topic !== undefined ? topic : existingClass.topic,
        description: description !== undefined ? description : existingClass.description,
        updatedAt: new Date()
      },
      include: {
        teacher: {
          select: {
            id: true,
            uid: true,
            fullName: true,
            subjects: true
          }
        },
        creator: {
          select: {
            id: true,
            uid: true,
            fullName: true
          }
        }
      }
    });
    
    res.json({ success: true, class: updatedClass });
  } catch (error) {
    console.error('Error updating scheduled class:', error);
    res.status(500).json({ error: 'Failed to update scheduled class' });
  }
});

// Delete a scheduled class (HEAD_TEACHER only)
router.delete('/:id', authenticateToken, requireRole('HEAD_TEACHER'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const existingClass = await prisma.classSchedule.findUnique({
      where: { id }
    });
    
    if (!existingClass) {
      return res.status(404).json({ error: 'Scheduled class not found' });
    }
    
    await prisma.classSchedule.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });
    
    res.json({ success: true, message: 'Scheduled class deleted successfully' });
  } catch (error) {
    console.error('Error deleting scheduled class:', error);
    res.status(500).json({ error: 'Failed to delete scheduled class' });
  }
});

// Get classes for a specific user based on their role
router.get('/my-classes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { date } = req.query;
    
    let where: any = {
      isActive: true
    };
    
    if (date) {
      const startDate = new Date(date as string);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      
      where.date = {
        gte: startDate,
        lt: endDate
      };
    }
    
    if (userRole === 'TEACHER') {
      where.teacherId = userId;
    } else if (userRole === 'STUDENT') {
      // For students, get classes for their batch
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { batchType: true }
      });
      
      if (user?.batchType) {
        where.batchType = user.batchType;
      }
    }
    
    const classes = await prisma.classSchedule.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            uid: true,
            fullName: true,
            subjects: true
          }
        },
        attendance: userRole === 'STUDENT' ? {
          where: { studentId: userId },
          select: {
            id: true,
            status: true,
            markedAt: true,
            notes: true
          }
        } : true
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' }
      ]
    });
    
    res.json({ success: true, classes });
  } catch (error) {
    console.error('Error fetching user classes:', error);
    res.status(500).json({ error: 'Failed to fetch user classes' });
  }
});

export default router;
