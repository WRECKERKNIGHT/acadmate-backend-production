import { Request, Response } from 'express';
import { PrismaClient, HomeworkStatus, SubmissionType, BatchType } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), 'uploads', 'homework');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and documents are allowed.'));
    }
  }
});

// Create homework assignment
export const createHomework = async (req: Request, res: Response) => {
  try {
    const { title, description, instructions, subject, batchType, dueDate, totalMarks } = req.body;
    const teacherId = req.user?.id;
    
    if (!teacherId) {
      return res.status(401).json({ error: 'Teacher not authenticated' });
    }

    // Handle file upload if present
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/homework/${req.file.filename}`;
    }

    const homework = await prisma.homework.create({
      data: {
        title,
        description,
        instructions,
        subject,
        teacherId,
        batchType: batchType as BatchType,
        imageUrl,
        dueDate: new Date(dueDate),
        totalMarks: parseInt(totalMarks) || 10,
        status: HomeworkStatus.ASSIGNED
      },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            subjects: true
          }
        },
        submissions: true,
        _count: {
          select: {
            submissions: true
          }
        }
      }
    });

    // Create notifications for all students in the batch
    const studentsInBatch = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        batchType: batchType as BatchType,
        isActive: true
      }
    });

    // Create notifications
    const notifications = studentsInBatch.map(student => ({
      userId: student.id,
      title: `New Homework: ${title}`,
      message: `${subject} homework assigned by ${req.user?.fullName}. Due: ${new Date(dueDate).toLocaleDateString()}`,
      type: 'INFO',
      actionUrl: `/homework/${homework.id}`
    }));

    await prisma.notification.createMany({
      data: notifications
    });

    res.status(201).json({
      success: true,
      message: 'Homework created successfully',
      homework
    });
  } catch (error) {
    console.error('Error creating homework:', error);
    res.status(500).json({ error: 'Failed to create homework' });
  }
};

// Get homework assignments
export const getHomeworkAssignments = async (req: Request, res: Response) => {
  try {
    const { batchType, status, teacherId } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let whereClause: any = {
      isActive: true
    };

    // Filter by batch type
    if (batchType) {
      whereClause.batchType = batchType as BatchType;
    }

    // Filter by status
    if (status) {
      whereClause.status = status as HomeworkStatus;
    }

    // Filter by teacher for teacher role
    if (userRole === 'TEACHER') {
      whereClause.teacherId = userId;
    } else if (teacherId) {
      whereClause.teacherId = teacherId;
    }

    const homework = await prisma.homework.findMany({
      where: whereClause,
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            subjects: true
          }
        },
        submissions: userRole === 'STUDENT' ? {
          where: { studentId: userId }
        } : true,
        _count: {
          select: {
            submissions: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      homework
    });
  } catch (error) {
    console.error('Error fetching homework:', error);
    res.status(500).json({ error: 'Failed to fetch homework assignments' });
  }
};

// Get homework by ID
export const getHomeworkById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const homework = await prisma.homework.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            subjects: true
          }
        },
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
    });

    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    // For students, only show their own submission
    if (userRole === 'STUDENT') {
      homework.submissions = homework.submissions.filter(sub => sub.studentId === userId);
    }

    res.json({
      success: true,
      homework
    });
  } catch (error) {
    console.error('Error fetching homework details:', error);
    res.status(500).json({ error: 'Failed to fetch homework details' });
  }
};

// Submit homework
export const submitHomework = async (req: Request, res: Response) => {
  try {
    const { homeworkId, submissionType, textContent, unableReason } = req.body;
    const studentId = req.user?.id;

    if (!studentId) {
      return res.status(401).json({ error: 'Student not authenticated' });
    }

    // Check if homework exists and is active
    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId }
    });

    if (!homework || !homework.isActive) {
      return res.status(404).json({ error: 'Homework not found or inactive' });
    }

    // Check if student belongs to the batch
    const student = await prisma.user.findUnique({
      where: { id: studentId }
    });

    if (student?.batchType !== homework.batchType) {
      return res.status(403).json({ error: 'You are not assigned to this homework' });
    }

    // Check if already submitted
    const existingSubmission = await prisma.homeworkSubmission.findUnique({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId
        }
      }
    });

    if (existingSubmission) {
      return res.status(400).json({ error: 'Homework already submitted' });
    }

    // Handle file upload if present
    let imageUrl = null;
    let documentUrl = null;
    
    if (req.file) {
      const fileExtension = path.extname(req.file.filename).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension)) {
        imageUrl = `/uploads/homework/${req.file.filename}`;
      } else {
        documentUrl = `/uploads/homework/${req.file.filename}`;
      }
    }

    // Create submission
    const submission = await prisma.homeworkSubmission.create({
      data: {
        homeworkId,
        studentId,
        submissionType: submissionType as SubmissionType,
        textContent: textContent || null,
        imageUrl,
        documentUrl,
        unableReason: unableReason || null,
        status: submissionType === 'UNABLE_TO_COMPLETE' ? HomeworkStatus.SUBMITTED : HomeworkStatus.SUBMITTED
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            uid: true
          }
        },
        homework: {
          select: {
            title: true,
            subject: true,
            teacher: {
              select: {
                id: true,
                fullName: true
              }
            }
          }
        }
      }
    });

    // Create notification for teacher
    await prisma.notification.create({
      data: {
        userId: homework.teacherId,
        title: `Homework Submitted: ${homework.title}`,
        message: `${student?.fullName} has submitted homework for ${homework.subject}`,
        type: 'INFO',
        actionUrl: `/homework/${homeworkId}/submissions`
      }
    });

    res.status(201).json({
      success: true,
      message: 'Homework submitted successfully',
      submission
    });
  } catch (error) {
    console.error('Error submitting homework:', error);
    res.status(500).json({ error: 'Failed to submit homework' });
  }
};

// Grade homework submission
export const gradeHomeworkSubmission = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { marksObtained, teacherRemarks, grade } = req.body;
    const teacherId = req.user?.id;

    if (!teacherId) {
      return res.status(401).json({ error: 'Teacher not authenticated' });
    }

    // Find the submission and verify teacher ownership
    const submission = await prisma.homeworkSubmission.findUnique({
      where: { id: submissionId },
      include: {
        homework: {
          select: {
            teacherId: true,
            totalMarks: true,
            title: true
          }
        },
        student: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (submission.homework.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized to grade this submission' });
    }

    // Update submission with grade
    const updatedSubmission = await prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        marksObtained: parseInt(marksObtained),
        teacherRemarks,
        grade,
        status: HomeworkStatus.REVIEWED,
        reviewedAt: new Date()
      },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            uid: true
          }
        },
        homework: {
          select: {
            title: true,
            subject: true,
            totalMarks: true
          }
        }
      }
    });

    // Create notification for student
    await prisma.notification.create({
      data: {
        userId: submission.student.id,
        title: `Homework Graded: ${submission.homework.title}`,
        message: `You scored ${marksObtained}/${submission.homework.totalMarks} in ${submission.homework.title}`,
        type: 'SUCCESS',
        actionUrl: `/homework/${submission.homeworkId}`
      }
    });

    res.json({
      success: true,
      message: 'Homework graded successfully',
      submission: updatedSubmission
    });
  } catch (error) {
    console.error('Error grading homework:', error);
    res.status(500).json({ error: 'Failed to grade homework' });
  }
};

// Get student's homework submissions
export const getStudentHomeworkSubmissions = async (req: Request, res: Response) => {
  try {
    const studentId = req.user?.id;
    const { status, subject } = req.query;

    if (!studentId) {
      return res.status(401).json({ error: 'Student not authenticated' });
    }

    let whereClause: any = {
      studentId
    };

    if (status) {
      whereClause.status = status as HomeworkStatus;
    }

    if (subject) {
      whereClause.homework = {
        subject: subject as string
      };
    }

    const submissions = await prisma.homeworkSubmission.findMany({
      where: whereClause,
      include: {
        homework: {
          select: {
            id: true,
            title: true,
            description: true,
            subject: true,
            dueDate: true,
            totalMarks: true,
            teacher: {
              select: {
                fullName: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      submissions
    });
  } catch (error) {
    console.error('Error fetching student submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
};

// Get homework statistics
export const getHomeworkStatistics = async (req: Request, res: Response) => {
  try {
    const { batchType, teacherId } = req.query;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    let whereClause: any = {
      isActive: true
    };

    if (batchType) {
      whereClause.batchType = batchType as BatchType;
    }

    if (userRole === 'TEACHER') {
      whereClause.teacherId = userId;
    } else if (teacherId) {
      whereClause.teacherId = teacherId;
    }

    const totalHomework = await prisma.homework.count({ where: whereClause });
    
    const submissionStats = await prisma.homeworkSubmission.groupBy({
      by: ['status'],
      _count: {
        status: true
      },
      where: {
        homework: whereClause
      }
    });

    const averageMarks = await prisma.homeworkSubmission.aggregate({
      _avg: {
        marksObtained: true
      },
      where: {
        homework: whereClause,
        marksObtained: { not: null }
      }
    });

    res.json({
      success: true,
      statistics: {
        totalHomework,
        submissionStats: submissionStats.reduce((acc, stat) => {
          acc[stat.status] = stat._count.status;
          return acc;
        }, {} as Record<string, number>),
        averageMarks: averageMarks._avg.marksObtained || 0
      }
    });
  } catch (error) {
    console.error('Error fetching homework statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

export default {
  createHomework,
  getHomeworkAssignments,
  getHomeworkById,
  submitHomework,
  gradeHomeworkSubmission,
  getStudentHomeworkSubmissions,
  getHomeworkStatistics
};