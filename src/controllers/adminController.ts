import { Request, Response } from 'express';
import { PrismaClient, Role, BatchType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Get all users with filtering and pagination
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { role, batchType, isActive, search, page = 1, limit = 20 } = req.query;
    
    let whereClause: any = {};
    
    if (role) whereClause.role = role as Role;
    if (batchType) whereClause.batchType = batchType as BatchType;
    if (isActive !== undefined) whereClause.isActive = isActive === 'true';
    
    if (search) {
      whereClause.OR = [
        { fullName: { contains: search as string, mode: 'insensitive' } },
        { uid: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          uid: true,
          fullName: true,
          role: true,
          batchType: true,
          subjects: true,
          roomNumber: true,
          phone: true,
          address: true,
          dateOfBirth: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              testsCreated: true,
              submissions: true,
              doubts: true,
              homeworkAssigned: true,
              homeworkSubmissions: true
            }
          }
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        currentPage: parseInt(page as string),
        totalPages: Math.ceil(totalCount / take),
        totalCount,
        limit: take
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Get user details by ID
export const getUserDetails = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        testsCreated: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            _count: { select: { submissions: true } }
          },
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        submissions: {
          select: {
            id: true,
            score: true,
            percentage: true,
            submittedAt: true,
            test: { select: { title: true, subject: true } }
          },
          take: 5,
          orderBy: { submittedAt: 'desc' }
        },
        doubts: {
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true
          },
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        homeworkAssigned: {
          select: {
            id: true,
            title: true,
            subject: true,
            dueDate: true,
            _count: { select: { submissions: true } }
          },
          take: 5,
          orderBy: { createdAt: 'desc' }
        },
        homeworkSubmissions: {
          select: {
            id: true,
            status: true,
            marksObtained: true,
            submittedAt: true,
            homework: { select: { title: true, subject: true } }
          },
          take: 5,
          orderBy: { submittedAt: 'desc' }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
};

// Create new user
export const createUser = async (req: Request, res: Response) => {
  try {
    const {
      uid,
      fullName,
      role,
      batchType,
      subjects,
      roomNumber,
      phone,
      address,
      dateOfBirth,
      password
    } = req.body;

    // Check if UID already exists
    const existingUser = await prisma.user.findUnique({
      where: { uid }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'UID already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        uid,
        password: hashedPassword,
        fullName,
        role: role as Role,
        batchType: batchType ? batchType as BatchType : null,
        subjects: subjects ? JSON.stringify(subjects) : null,
        roomNumber,
        phone,
        address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        isActive: true
      },
      select: {
        id: true,
        uid: true,
        fullName: true,
        role: true,
        batchType: true,
        subjects: true,
        roomNumber: true,
        phone: true,
        address: true,
        dateOfBirth: true,
        isActive: true,
        createdAt: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// Update user details
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const {
      fullName,
      role,
      batchType,
      subjects,
      roomNumber,
      phone,
      address,
      dateOfBirth,
      isActive
    } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        role: role as Role,
        batchType: batchType ? batchType as BatchType : null,
        subjects: subjects ? JSON.stringify(subjects) : null,
        roomNumber,
        phone,
        address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        isActive
      },
      select: {
        id: true,
        uid: true,
        fullName: true,
        role: true,
        batchType: true,
        subjects: true,
        roomNumber: true,
        phone: true,
        address: true,
        dateOfBirth: true,
        isActive: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// Delete user (soft delete)
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating user:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
};

// Get teacher activities and performance
export const getTeacherActivities = async (req: Request, res: Response) => {
  try {
    const teachers = await prisma.user.findMany({
      where: { 
        role: 'TEACHER',
        isActive: true
      },
      select: {
        id: true,
        uid: true,
        fullName: true,
        subjects: true,
        batchType: true,
        lastLoginAt: true,
        _count: {
          select: {
            testsCreated: true,
            homeworkAssigned: true,
            scheduledClasses: true,
            teacherAttendance: true
          }
        }
      }
    });

    // Get recent activities for each teacher
    const teacherActivities = await Promise.all(
      teachers.map(async (teacher) => {
        const [recentTests, recentHomework, totalStudentsTaught] = await Promise.all([
          prisma.test.findMany({
            where: { authorId: teacher.id },
            select: { title: true, createdAt: true, status: true },
            take: 3,
            orderBy: { createdAt: 'desc' }
          }),
          prisma.homework.findMany({
            where: { teacherId: teacher.id },
            select: { title: true, createdAt: true, dueDate: true },
            take: 3,
            orderBy: { createdAt: 'desc' }
          }),
          prisma.user.count({
            where: {
              role: 'STUDENT',
              batchType: teacher.batchType,
              isActive: true
            }
          })
        ]);

        return {
          ...teacher,
          recentTests,
          recentHomework,
          totalStudentsTaught,
          subjects: teacher.subjects ? JSON.parse(teacher.subjects) : []
        };
      })
    );

    res.json({
      success: true,
      teachers: teacherActivities
    });
  } catch (error) {
    console.error('Error fetching teacher activities:', error);
    res.status(500).json({ error: 'Failed to fetch teacher activities' });
  }
};

// Change teacher batch assignment
export const changeTeacherBatch = async (req: Request, res: Response) => {
  try {
    const { teacherId } = req.params;
    const { batchType, subjects } = req.body;

    const updatedTeacher = await prisma.user.update({
      where: { 
        id: teacherId,
        role: 'TEACHER'
      },
      data: {
        batchType: batchType as BatchType,
        subjects: subjects ? JSON.stringify(subjects) : null
      },
      select: {
        id: true,
        fullName: true,
        batchType: true,
        subjects: true
      }
    });

    // Create notification for the teacher
    await prisma.notification.create({
      data: {
        userId: teacherId,
        title: 'Batch Assignment Updated',
        message: `Your batch assignment has been updated to ${batchType}`,
        type: 'INFO'
      }
    });

    res.json({
      success: true,
      message: 'Teacher batch assignment updated successfully',
      teacher: updatedTeacher
    });
  } catch (error) {
    console.error('Error updating teacher batch:', error);
    res.status(500).json({ error: 'Failed to update teacher batch assignment' });
  }
};

// Get system statistics for admin dashboard
export const getAdminStatistics = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalTests,
      totalSubmissions,
      totalDoubts,
      totalHomework,
      recentActivity
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.test.count(),
      prisma.submission.count(),
      prisma.doubt.count(),
      prisma.homework.count(),
      prisma.user.findMany({
        where: { lastLoginAt: { not: null } },
        select: {
          id: true,
          fullName: true,
          role: true,
          lastLoginAt: true
        },
        orderBy: { lastLoginAt: 'desc' },
        take: 10
      })
    ]);

    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
      where: { isActive: true }
    });

    const usersByBatch = await prisma.user.groupBy({
      by: ['batchType'],
      _count: { batchType: true },
      where: { 
        role: 'STUDENT',
        isActive: true,
        batchType: { not: null }
      }
    });

    res.json({
      success: true,
      statistics: {
        totalUsers,
        activeUsers,
        totalTests,
        totalSubmissions,
        totalDoubts,
        totalHomework,
        usersByRole: usersByRole.reduce((acc, item) => {
          acc[item.role] = item._count.role;
          return acc;
        }, {} as Record<string, number>),
        usersByBatch: usersByBatch.reduce((acc, item) => {
          if (item.batchType) {
            acc[item.batchType] = item._count.batchType;
          }
          return acc;
        }, {} as Record<string, number>),
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching admin statistics:', error);
    res.status(500).json({ error: 'Failed to fetch admin statistics' });
  }
};

// Bulk user operations
export const bulkUserOperations = async (req: Request, res: Response) => {
  try {
    const { operation, userIds, data } = req.body;

    let result;
    switch (operation) {
      case 'activate':
        result = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: true }
        });
        break;
      
      case 'deactivate':
        result = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: false }
        });
        break;
      
      case 'changeBatch':
        result = await prisma.user.updateMany({
          where: { 
            id: { in: userIds },
            role: 'STUDENT'
          },
          data: { batchType: data.batchType as BatchType }
        });
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid operation' });
    }

    res.json({
      success: true,
      message: `Bulk ${operation} completed successfully`,
      affectedRecords: result.count
    });
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
};

export default {
  getAllUsers,
  getUserDetails,
  createUser,
  updateUser,
  deleteUser,
  getTeacherActivities,
  changeTeacherBatch,
  getAdminStatistics,
  bulkUserOperations
};