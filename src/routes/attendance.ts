import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Mark attendance for a class (TEACHER or HEAD_TEACHER only)
router.post('/mark', authenticateToken, async (req, res) => {
  try {
    const { classScheduleId, attendanceData } = req.body;
    
    if (!classScheduleId || !attendanceData || !Array.isArray(attendanceData)) {
      return res.status(400).json({ error: 'Missing required fields or invalid data format' });
    }
    
    // Check if user is teacher or head teacher
    const userRole = req.user!.role;
    if (userRole !== 'TEACHER' && userRole !== 'HEAD_TEACHER') {
      return res.status(403).json({ error: 'Only teachers can mark attendance' });
    }
    
    // Verify the class exists and the teacher is authorized
    const classSchedule = await prisma.classSchedule.findUnique({
      where: { id: classScheduleId },
      include: { teacher: true }
    });
    
    if (!classSchedule) {
      return res.status(404).json({ error: 'Class schedule not found' });
    }
    
    // Check if the teacher is authorized to mark attendance for this class
    if (userRole === 'TEACHER' && classSchedule.teacherId !== req.user!.userId) {
      return res.status(403).json({ error: 'You are not authorized to mark attendance for this class' });
    }
    
    // Process attendance data
    const attendanceRecords = [];
    const errors = [];
    
    for (const record of attendanceData) {
      const { studentId, status, notes } = record;
      
      if (!studentId || !status) {
        errors.push(`Missing studentId or status for record`);
        continue;
      }
      
      if (!['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status)) {
        errors.push(`Invalid status '${status}' for student ${studentId}`);
        continue;
      }
      
      try {
        // Check if student exists and is in the correct batch
        const student = await prisma.user.findUnique({
          where: { id: studentId },
          select: { id: true, role: true, batchType: true, isActive: true }
        });
        
        if (!student || student.role !== 'STUDENT' || !student.isActive) {
          errors.push(`Invalid student: ${studentId}`);
          continue;
        }
        
        if (student.batchType !== classSchedule.batchType) {
          errors.push(`Student ${studentId} is not in the correct batch for this class`);
          continue;
        }
        
        // Upsert attendance record
        const attendanceRecord = await prisma.attendance.upsert({
          where: {
            classScheduleId_studentId: {
              classScheduleId,
              studentId
            }
          },
          update: {
            status,
            notes: notes || null,
            teacherId: req.user!.userId,
            markedAt: new Date(),
            updatedAt: new Date()
          },
          create: {
            classScheduleId,
            studentId,
            teacherId: req.user!.userId,
            status,
            notes: notes || null
          },
          include: {
            student: {
              select: {
                id: true,
                uid: true,
                fullName: true
              }
            }
          }
        });
        
        attendanceRecords.push(attendanceRecord);
      } catch (error) {
        console.error(`Error processing attendance for student ${studentId}:`, error);
        errors.push(`Error processing attendance for student ${studentId}`);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Some attendance records could not be processed', 
        errors,
        successful: attendanceRecords
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Attendance marked successfully',
      attendance: attendanceRecords 
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ error: 'Failed to mark attendance' });
  }
});

// Get attendance for a specific class
router.get('/class/:classScheduleId', authenticateToken, async (req, res) => {
  try {
    const { classScheduleId } = req.params;
    const userRole = req.user!.role;
    const userId = req.user!.userId;
    
    // Verify the class exists
    const classSchedule = await prisma.classSchedule.findUnique({
      where: { id: classScheduleId },
      include: {
        teacher: {
          select: { id: true, fullName: true }
        }
      }
    });
    
    if (!classSchedule) {
      return res.status(404).json({ error: 'Class schedule not found' });
    }
    
    // Check authorization
    if (userRole === 'TEACHER' && classSchedule.teacherId !== userId) {
      return res.status(403).json({ error: 'You are not authorized to view attendance for this class' });
    }
    
    const attendance = await prisma.attendance.findMany({
      where: { classScheduleId },
      include: {
        student: {
          select: {
            id: true,
            uid: true,
            fullName: true
          }
        },
        teacher: {
          select: {
            id: true,
            fullName: true
          }
        }
      },
      orderBy: {
        student: {
          fullName: 'asc'
        }
      }
    });
    
    // Get list of all students in the batch who should attend this class
    const allStudents = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        batchType: classSchedule.batchType,
        isActive: true
      },
      select: {
        id: true,
        uid: true,
        fullName: true
      }
    });
    
    // Create attendance summary
    const attendanceMap = new Map(attendance.map(a => [a.studentId, a]));
    const summary = allStudents.map(student => ({
      student,
      attendance: attendanceMap.get(student.id) || null
    }));
    
    res.json({ 
      success: true, 
      classSchedule,
      attendance: summary,
      stats: {
        total: allStudents.length,
        present: attendance.filter(a => a.status === 'PRESENT').length,
        absent: attendance.filter(a => a.status === 'ABSENT').length,
        late: attendance.filter(a => a.status === 'LATE').length,
        excused: attendance.filter(a => a.status === 'EXCUSED').length
      }
    });
  } catch (error) {
    console.error('Error fetching class attendance:', error);
    res.status(500).json({ error: 'Failed to fetch class attendance' });
  }
});

// Get attendance history for a student
router.get('/student/:studentId', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, subject } = req.query;
    const userRole = req.user!.role;
    const userId = req.user!.userId;
    
    // Students can only view their own attendance
    if (userRole === 'STUDENT' && studentId !== userId) {
      return res.status(403).json({ error: 'You can only view your own attendance' });
    }
    
    // Teachers can only view attendance for their classes
    let classFilter: any = {};
    if (userRole === 'TEACHER') {
      classFilter.teacherId = userId;
    }
    
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      };
    }
    
    let subjectFilter: any = {};
    if (subject) {
      subjectFilter.subject = subject;
    }
    
    const attendance = await prisma.attendance.findMany({
      where: {
        studentId,
        classSchedule: {
          ...classFilter,
          ...dateFilter,
          ...subjectFilter
        }
      },
      include: {
        classSchedule: {
          select: {
            id: true,
            subject: true,
            date: true,
            startTime: true,
            endTime: true,
            roomNumber: true,
            teacher: {
              select: {
                fullName: true
              }
            }
          }
        },
        teacher: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: {
        classSchedule: {
          date: 'desc'
        }
      }
    });
    
    // Calculate statistics
    const stats = {
      total: attendance.length,
      present: attendance.filter(a => a.status === 'PRESENT').length,
      absent: attendance.filter(a => a.status === 'ABSENT').length,
      late: attendance.filter(a => a.status === 'LATE').length,
      excused: attendance.filter(a => a.status === 'EXCUSED').length,
      percentage: attendance.length > 0 ? 
        Math.round((attendance.filter(a => a.status === 'PRESENT').length / attendance.length) * 100) : 0
    };
    
    res.json({ 
      success: true, 
      attendance,
      stats
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({ error: 'Failed to fetch student attendance' });
  }
});

// Get attendance summary for all students in a batch (HEAD_TEACHER only)
router.get('/batch/:batchType', authenticateToken, requireRole('HEAD_TEACHER'), async (req, res) => {
  try {
    const { batchType } = req.params;
    const { startDate, endDate } = req.query;
    
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        date: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        }
      };
    }
    
    // Get all students in the batch
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        batchType: batchType as any,
        isActive: true
      },
      select: {
        id: true,
        uid: true,
        fullName: true
      }
    });
    
    // Get attendance data for all students
    const attendanceData = await prisma.attendance.findMany({
      where: {
        studentId: { in: students.map(s => s.id) },
        classSchedule: {
          batchType: batchType as any,
          ...dateFilter
        }
      },
      include: {
        student: {
          select: {
            id: true,
            uid: true,
            fullName: true
          }
        },
        classSchedule: {
          select: {
            subject: true,
            date: true
          }
        }
      }
    });
    
    // Calculate statistics for each student
    const studentStats = students.map(student => {
      const studentAttendance = attendanceData.filter(a => a.studentId === student.id);
      const total = studentAttendance.length;
      const present = studentAttendance.filter(a => a.status === 'PRESENT').length;
      
      return {
        student,
        stats: {
          total,
          present,
          absent: studentAttendance.filter(a => a.status === 'ABSENT').length,
          late: studentAttendance.filter(a => a.status === 'LATE').length,
          excused: studentAttendance.filter(a => a.status === 'EXCUSED').length,
          percentage: total > 0 ? Math.round((present / total) * 100) : 0
        }
      };
    });
    
    res.json({ 
      success: true, 
      batchType,
      students: studentStats,
      overallStats: {
        totalStudents: students.length,
        averageAttendance: studentStats.length > 0 ? 
          Math.round(studentStats.reduce((sum, s) => sum + s.stats.percentage, 0) / studentStats.length) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching batch attendance summary:', error);
    res.status(500).json({ error: 'Failed to fetch batch attendance summary' });
  }
});

// Get students for a specific class to mark attendance
router.get('/students/:classScheduleId', authenticateToken, async (req, res) => {
  try {
    const { classScheduleId } = req.params;
    const userRole = req.user!.role;
    const userId = req.user!.userId;
    
    // Verify the class exists
    const classSchedule = await prisma.classSchedule.findUnique({
      where: { id: classScheduleId },
      select: {
        id: true,
        subject: true,
        batchType: true,
        teacherId: true,
        date: true,
        startTime: true,
        endTime: true,
        teacher: {
          select: { fullName: true }
        }
      }
    });
    
    if (!classSchedule) {
      return res.status(404).json({ error: 'Class schedule not found' });
    }
    
    // Check authorization
    if (userRole === 'TEACHER' && classSchedule.teacherId !== userId) {
      return res.status(403).json({ error: 'You are not authorized to view students for this class' });
    }
    
    // Get all students in the batch
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        batchType: classSchedule.batchType,
        isActive: true
      },
      select: {
        id: true,
        uid: true,
        fullName: true
      },
      orderBy: {
        fullName: 'asc'
      }
    });
    
    // Get existing attendance for this class
    const existingAttendance = await prisma.attendance.findMany({
      where: { classScheduleId },
      select: {
        studentId: true,
        status: true,
        notes: true,
        markedAt: true
      }
    });
    
    const attendanceMap = new Map(existingAttendance.map(a => [a.studentId, a]));
    
    const studentsWithAttendance = students.map(student => ({
      ...student,
      attendance: attendanceMap.get(student.id) || null
    }));
    
    res.json({ 
      success: true, 
      classSchedule,
      students: studentsWithAttendance
    });
  } catch (error) {
    console.error('Error fetching students for attendance:', error);
    res.status(500).json({ error: 'Failed to fetch students for attendance' });
  }
});

export default router;