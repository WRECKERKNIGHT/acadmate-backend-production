import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth.js';
const router = express.Router();
const prisma = new PrismaClient();
// GET /api/schedule - Get all scheduled classes
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { batchType, date } = req.query;
        let whereCondition = {};
        // Add filters if provided
        if (batchType) {
            whereCondition.batchType = batchType;
        }
        if (date) {
            const filterDate = new Date(date);
            const nextDay = new Date(filterDate);
            nextDay.setDate(nextDay.getDate() + 1);
            whereCondition.date = {
                gte: filterDate,
                lt: nextDay
            };
        }
        if (role === 'TEACHER') {
            // Teachers see only their classes
            whereCondition.teacherId = userId;
        }
        else if (role === 'STUDENT') {
            // Students see only classes for their batch
            const student = await prisma.user.findUnique({
                where: { id: userId },
                select: { batchType: true }
            });
            if (student?.batchType) {
                whereCondition.batchType = student.batchType;
            }
        }
        const classes = await prisma.classSchedule.findMany({
            where: whereCondition,
            include: {
                teacher: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true,
                        subjects: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true
                    }
                }
            },
            orderBy: [
                { date: 'asc' },
                { startTime: 'asc' }
            ]
        });
        res.json(classes);
    }
    catch (error) {
        console.error('Get scheduled classes error:', error);
        res.status(500).json({ error: 'Failed to fetch scheduled classes' });
    }
});
// POST /api/schedule - Create a new class (head teacher only)
router.post('/', authenticateToken, requireRole('HEAD_TEACHER'), async (req, res) => {
    try {
        const creatorId = req.user.userId;
        const { subject, teacherId, batchType, roomNumber, date, startTime, endTime, topic, description } = req.body;
        // Validate required fields
        if (!subject || !teacherId || !batchType || !roomNumber || !date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Validate teacher exists and has the correct role
        const teacher = await prisma.user.findUnique({
            where: { id: teacherId, role: 'TEACHER' }
        });
        if (!teacher) {
            return res.status(400).json({ error: 'Invalid teacher' });
        }
        // Check for scheduling conflicts for the teacher
        const conflictingClass = await prisma.classSchedule.findFirst({
            where: {
                teacherId,
                date: new Date(date),
                OR: [
                    {
                        // Class starts during another class
                        startTime: {
                            gte: startTime,
                            lt: endTime
                        }
                    },
                    {
                        // Class ends during another class
                        endTime: {
                            gt: startTime,
                            lte: endTime
                        }
                    },
                    {
                        // Class encompasses another class
                        AND: [
                            { startTime: { lte: startTime } },
                            { endTime: { gte: endTime } }
                        ]
                    }
                ]
            }
        });
        if (conflictingClass) {
            return res.status(409).json({ error: 'Teacher has a scheduling conflict' });
        }
        // Create the class schedule
        const classSchedule = await prisma.classSchedule.create({
            data: {
                subject,
                teacherId,
                creatorId,
                batchType,
                roomNumber,
                date: new Date(date),
                startTime,
                endTime,
                topic,
                description
            },
            include: {
                teacher: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true,
                        subjects: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true
                    }
                }
            }
        });
        // Create notifications for the teacher
        await prisma.notification.create({
            data: {
                userId: teacherId,
                title: 'New Class Scheduled',
                message: `You have been assigned to teach ${subject} on ${new Date(date).toLocaleDateString()} from ${startTime} to ${endTime}`,
                type: 'INFO',
                actionUrl: `/schedule/${classSchedule.id}`
            }
        });
        // Create notifications for students in the batch
        const studentsInBatch = await prisma.user.findMany({
            where: {
                role: 'STUDENT',
                batchType
            }
        });
        if (studentsInBatch.length > 0) {
            const studentNotifications = studentsInBatch.map(student => ({
                userId: student.id,
                title: 'New Class Scheduled',
                message: `A new ${subject} class has been scheduled on ${new Date(date).toLocaleDateString()} from ${startTime} to ${endTime}`,
                type: 'INFO',
                actionUrl: `/schedule`
            }));
            await prisma.notification.createMany({
                data: studentNotifications
            });
        }
        res.status(201).json(classSchedule);
    }
    catch (error) {
        console.error('Create class schedule error:', error);
        res.status(500).json({ error: 'Failed to create class schedule' });
    }
});
// GET /api/schedule/:id - Get a specific scheduled class
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const classSchedule = await prisma.classSchedule.findUnique({
            where: { id },
            include: {
                teacher: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true,
                        subjects: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true
                    }
                }
            }
        });
        if (!classSchedule) {
            return res.status(404).json({ error: 'Class schedule not found' });
        }
        res.json(classSchedule);
    }
    catch (error) {
        console.error('Get class schedule error:', error);
        res.status(500).json({ error: 'Failed to fetch class schedule' });
    }
});
// PUT /api/schedule/:id - Update a scheduled class (head teacher only)
router.put('/:id', authenticateToken, requireRole('HEAD_TEACHER'), async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, teacherId, batchType, roomNumber, date, startTime, endTime, topic, description, isActive } = req.body;
        const classSchedule = await prisma.classSchedule.findUnique({
            where: { id }
        });
        if (!classSchedule) {
            return res.status(404).json({ error: 'Class schedule not found' });
        }
        // If changing date, time, or teacher, check for conflicts
        if ((teacherId && teacherId !== classSchedule.teacherId) ||
            (date && new Date(date).toISOString() !== classSchedule.date.toISOString()) ||
            (startTime && startTime !== classSchedule.startTime) ||
            (endTime && endTime !== classSchedule.endTime)) {
            const conflictingClass = await prisma.classSchedule.findFirst({
                where: {
                    id: { not: id }, // Exclude current class
                    teacherId: teacherId || classSchedule.teacherId,
                    date: date ? new Date(date) : classSchedule.date,
                    OR: [
                        {
                            startTime: {
                                gte: startTime || classSchedule.startTime,
                                lt: endTime || classSchedule.endTime
                            }
                        },
                        {
                            endTime: {
                                gt: startTime || classSchedule.startTime,
                                lte: endTime || classSchedule.endTime
                            }
                        },
                        {
                            AND: [
                                { startTime: { lte: startTime || classSchedule.startTime } },
                                { endTime: { gte: endTime || classSchedule.endTime } }
                            ]
                        }
                    ]
                }
            });
            if (conflictingClass) {
                return res.status(409).json({ error: 'Teacher has a scheduling conflict' });
            }
        }
        // Update the class schedule
        const updatedClassSchedule = await prisma.classSchedule.update({
            where: { id },
            data: {
                subject: subject !== undefined ? subject : undefined,
                teacherId: teacherId !== undefined ? teacherId : undefined,
                batchType: batchType !== undefined ? batchType : undefined,
                roomNumber: roomNumber !== undefined ? roomNumber : undefined,
                date: date !== undefined ? new Date(date) : undefined,
                startTime: startTime !== undefined ? startTime : undefined,
                endTime: endTime !== undefined ? endTime : undefined,
                topic: topic !== undefined ? topic : undefined,
                description: description !== undefined ? description : undefined,
                isActive: isActive !== undefined ? isActive : undefined
            },
            include: {
                teacher: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true,
                        subjects: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true
                    }
                }
            }
        });
        // Send notifications about the update
        if (teacherId !== undefined && teacherId !== classSchedule.teacherId) {
            // Notify new teacher
            await prisma.notification.create({
                data: {
                    userId: teacherId,
                    title: 'Class Assignment',
                    message: `You have been assigned to teach ${updatedClassSchedule.subject} on ${updatedClassSchedule.date.toLocaleDateString()} from ${updatedClassSchedule.startTime} to ${updatedClassSchedule.endTime}`,
                    type: 'INFO',
                    actionUrl: `/schedule/${id}`
                }
            });
            // Notify old teacher
            await prisma.notification.create({
                data: {
                    userId: classSchedule.teacherId,
                    title: 'Class Reassigned',
                    message: `The ${updatedClassSchedule.subject} class on ${classSchedule.date.toLocaleDateString()} has been reassigned to another teacher`,
                    type: 'INFO'
                }
            });
        }
        else if (date !== undefined || startTime !== undefined || endTime !== undefined) {
            // Notify teacher of schedule change
            await prisma.notification.create({
                data: {
                    userId: updatedClassSchedule.teacherId,
                    title: 'Class Schedule Updated',
                    message: `The ${updatedClassSchedule.subject} class has been rescheduled to ${updatedClassSchedule.date.toLocaleDateString()} from ${updatedClassSchedule.startTime} to ${updatedClassSchedule.endTime}`,
                    type: 'INFO',
                    actionUrl: `/schedule/${id}`
                }
            });
            // Notify students of the batch
            const studentsInBatch = await prisma.user.findMany({
                where: {
                    role: 'STUDENT',
                    batchType: updatedClassSchedule.batchType
                }
            });
            if (studentsInBatch.length > 0) {
                const studentNotifications = studentsInBatch.map(student => ({
                    userId: student.id,
                    title: 'Class Schedule Updated',
                    message: `The ${updatedClassSchedule.subject} class has been rescheduled to ${updatedClassSchedule.date.toLocaleDateString()} from ${updatedClassSchedule.startTime} to ${updatedClassSchedule.endTime}`,
                    type: 'INFO',
                    actionUrl: '/schedule'
                }));
                await prisma.notification.createMany({
                    data: studentNotifications
                });
            }
        }
        res.json(updatedClassSchedule);
    }
    catch (error) {
        console.error('Update class schedule error:', error);
        res.status(500).json({ error: 'Failed to update class schedule' });
    }
});
// DELETE /api/schedule/:id - Delete a scheduled class (head teacher only)
router.delete('/:id', authenticateToken, requireRole('HEAD_TEACHER'), async (req, res) => {
    try {
        const { id } = req.params;
        const classSchedule = await prisma.classSchedule.findUnique({
            where: { id },
            include: {
                teacher: true
            }
        });
        if (!classSchedule) {
            return res.status(404).json({ error: 'Class schedule not found' });
        }
        // Delete the class schedule
        await prisma.classSchedule.delete({
            where: { id }
        });
        // Notify the teacher
        await prisma.notification.create({
            data: {
                userId: classSchedule.teacherId,
                title: 'Class Cancelled',
                message: `The ${classSchedule.subject} class scheduled for ${classSchedule.date.toLocaleDateString()} has been cancelled`,
                type: 'WARNING'
            }
        });
        // Notify students of the batch
        const studentsInBatch = await prisma.user.findMany({
            where: {
                role: 'STUDENT',
                batchType: classSchedule.batchType
            }
        });
        if (studentsInBatch.length > 0) {
            const studentNotifications = studentsInBatch.map(student => ({
                userId: student.id,
                title: 'Class Cancelled',
                message: `The ${classSchedule.subject} class scheduled for ${classSchedule.date.toLocaleDateString()} has been cancelled`,
                type: 'WARNING',
                actionUrl: '/schedule'
            }));
            await prisma.notification.createMany({
                data: studentNotifications
            });
        }
        res.json({ message: 'Class schedule deleted successfully' });
    }
    catch (error) {
        console.error('Delete class schedule error:', error);
        res.status(500).json({ error: 'Failed to delete class schedule' });
    }
});
export default router;
