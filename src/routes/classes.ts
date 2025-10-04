import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Get all classes (teachers see all, students see their enrolled classes)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { userId, role } = req.user!;
    
    if (role === 'TEACHER') {
      const classes = await prisma.class.findMany({
        include: {
          students: {
            include: {
              student: {
                select: {
                  id: true,
                  fullName: true,
                  uid: true
                },
              }
            }
          },
          tests: {
            where: { status: 'PUBLISHED' },
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              students: true,
              tests: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      res.json(classes);
    } else {
      // Students see their enrolled classes
      const studentClasses = await prisma.classStudent.findMany({
        where: { studentId: userId },
        include: {
          class: {
            include: {
              tests: {
                where: { status: 'PUBLISHED' },
                select: {
                  id: true,
                  title: true,
                  status: true,
                  createdAt: true
                }
              },
              _count: {
                select: {
                  students: true,
                  tests: true
                }
              }
            }
          }
        }
      });
      
      const classes = studentClasses.map(sc => ({
        ...sc.class,
        joinedAt: sc.joinedAt
      }));
      
      res.json(classes);
    }
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// Get single class
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user!;
    
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                uid: true,
                batchType: true
              }
            }
          }
        },
        tests: {
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
                uid: true
              }
            },
            _count: {
              select: {
                submissions: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check access for students
    if (role === 'STUDENT') {
      const hasAccess = await prisma.classStudent.findFirst({
        where: {
          classId: id,
          studentId: userId
        }
      });
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    res.json(classData);
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ error: 'Failed to fetch class' });
  }
});

// Create new class (teachers only)
router.post('/', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { name, description, subject, grade } = req.body;
    
    const classData = await prisma.class.create({
      data: {
        name,
        description,
        subject,
        grade
      }
    });
    
    res.status(201).json(classData);
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// Update class (teachers only)
router.put('/:id', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const updatedClass = await prisma.class.update({
      where: { id },
      data: req.body
    });
    
    res.json(updatedClass);
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// Add student to class (teachers only)
router.post('/:id/students', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { studentEmail } = req.body;
    
    // Find student by email
    const student = await prisma.user.findUnique({
      where: { uid: studentEmail, role: 'STUDENT' }
    });
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Check if already enrolled
    const existingEnrollment = await prisma.classStudent.findUnique({
      where: {
        classId_studentId: {
          classId: id,
          studentId: student.id
        }
      }
    });
    
    if (existingEnrollment) {
      return res.status(400).json({ error: 'Student is already enrolled in this class' });
    }
    
    const enrollment = await prisma.classStudent.create({
      data: {
        classId: id,
        studentId: student.id
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            uid: true
          }
        },
        class: {
          select: {
            id: true,
            name: true,
            subject: true
          }
        }
      }
    });
    
    // Create notification for student
    await prisma.notification.create({
      data: {
        userId: student.id,
        title: 'Added to Class',
        message: `You have been enrolled in the class`,
        type: 'SUCCESS',
        actionUrl: `/classes/${id}`
      }
    });
    
    res.status(201).json(enrollment);
  } catch (error) {
    console.error('Add student to class error:', error);
    res.status(500).json({ error: 'Failed to add student to class' });
  }
});

// Remove student from class (teachers only)
router.delete('/:id/students/:studentId', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { id, studentId } = req.params;
    
    const enrollment = await prisma.classStudent.findUnique({
      where: {
        classId_studentId: {
          classId: id,
          studentId
        }
      },
      include: {
        student: {
          select: {
            fullName: true
          }
        },
        class: {
          select: {
            name: true
          }
        }
      }
    });
    
    if (!enrollment) {
      return res.status(404).json({ error: 'Student enrollment not found' });
    }
    
    await prisma.classStudent.delete({
      where: {
        classId_studentId: {
          classId: id,
          studentId
        }
      }
    });
    
    // Create notification for student
    await prisma.notification.create({
      data: {
        userId: studentId,
        title: 'Removed from Class',
        message: `You have been removed from the class \"${enrollment.class.name}\"`,
        type: 'INFO'
      }
    });
    
    res.json({ message: 'Student removed from class successfully' });
  } catch (error) {
    console.error('Remove student from class error:', error);
    res.status(500).json({ error: 'Failed to remove student from class' });
  }
});

// Get class analytics (teachers only)
router.get('/:id/analytics', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                uid: true
              }
            }
          }
        },
        tests: {
          include: {
            submissions: {
              include: {
                student: {
                  select: {
                    id: true,
                    fullName: true,
                    uid: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Calculate analytics
    const analytics = {
      totalStudents: classData.students.length,
      totalTests: classData.tests.length,
      totalSubmissions: classData.tests.reduce((acc: number, test: any) => acc + test.submissions.length, 0),
      averageScore: 0,
      testParticipation: [] as any[],
      studentPerformance: [] as any[]
    };
    
    // Calculate average score
    let totalScores = 0;
    let totalSubmissions = 0;
    
    classData.tests.forEach((test: any) => {
      test.submissions.forEach((submission: any) => {
        totalScores += submission.percentage;
        totalSubmissions++;
      });
    });
    
    if (totalSubmissions > 0) {
      analytics.averageScore = Math.round(totalScores / totalSubmissions);
    }
    
    // Calculate test participation
    analytics.testParticipation = classData.tests.map((test: any) => ({
      testId: test.id,
      testTitle: test.title,
      totalStudents: classData.students.length,
      submissionsCount: test.submissions.length,
      participationRate: classData.students.length > 0 
        ? Math.round((test.submissions.length / classData.students.length) * 100) 
        : 0,
      averageScore: test.submissions.length > 0
        ? Math.round(test.submissions.reduce((acc: number, sub: any) => acc + sub.percentage, 0) / test.submissions.length)
        : 0
    }));
    
    // Calculate student performance
    analytics.studentPerformance = classData.students.map((enrollment: any) => {
      const studentSubmissions = classData.tests.flatMap((test: any) =>
        test.submissions.filter((sub: any) => sub.studentId === enrollment.studentId)
      );
      
      const averageScore = studentSubmissions.length > 0
        ? Math.round(studentSubmissions.reduce((acc: number, sub: any) => acc + sub.percentage, 0) / studentSubmissions.length)
        : 0;
      
      return {
        student: enrollment.student,
        testsAttempted: studentSubmissions.length,
        totalTests: classData.tests.length,
        averageScore,
        completionRate: classData.tests.length > 0
          ? Math.round((studentSubmissions.length / classData.tests.length) * 100)
          : 0
      };
    });
    
    res.json(analytics);
  } catch (error) {
    console.error('Get class analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch class analytics' });
  }
});

// Delete class (teachers only)
router.delete('/:id', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Check if class has active tests
    const activeTests = await prisma.test.findMany({
      where: {
        classId: id,
        status: { in: ['PUBLISHED', 'ACTIVE'] }
      }
    });
    
    if (activeTests.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete class with active tests. Please archive or delete the tests first.' 
      });
    }
    
    await prisma.class.delete({
      where: { id }
    });
    
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

export default router;

