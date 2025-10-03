import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();
const prisma = new PrismaClient();
// Get all doubts (students see their own, teachers see all pending)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { status, priority } = req.query;
        let whereCondition = {};
        if (role === 'STUDENT') {
            whereCondition.studentId = userId;
        }
        else if (role === 'TEACHER') {
            // Teachers can see all doubts or filter by status
            if (status) {
                whereCondition.status = status;
            }
        }
        if (priority) {
            whereCondition.priority = priority;
        }
        const doubts = await prisma.doubt.findMany({
            where: whereCondition,
            include: {
                student: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true,
                        batchType: true
                    }
                },
                appointment: {
                    include: {
                        teacher: {
                            select: {
                                id: true,
                                fullName: true,
                                uid: true,
                                subjects: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(doubts);
    }
    catch (error) {
        console.error('Get doubts error:', error);
        res.status(500).json({ error: 'Failed to fetch doubts' });
    }
});
// Get single doubt
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, role } = req.user;
        const doubt = await prisma.doubt.findUnique({
            where: { id },
            include: {
                student: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true
                    }
                },
                appointment: {
                    include: {
                        teacher: {
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
        if (!doubt) {
            return res.status(404).json({ error: 'Doubt not found' });
        }
        // Check permissions
        if (role === 'STUDENT' && doubt.studentId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json(doubt);
    }
    catch (error) {
        console.error('Get doubt error:', error);
        res.status(500).json({ error: 'Failed to fetch doubt' });
    }
});
// Create new doubt (students only)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { userId, role } = req.user;
        const { subject, description, imageUrl, priority } = req.body;
        if (role !== 'STUDENT') {
            return res.status(403).json({ error: 'Only students can create doubts' });
        }
        const doubt = await prisma.doubt.create({
            data: {
                studentId: userId,
                subject,
                description,
                imageUrl,
                priority: priority || 'MEDIUM'
            },
            include: {
                student: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true
                    }
                }
            }
        });
        // Create notification for teachers
        const teachers = await prisma.user.findMany({
            where: { role: 'TEACHER', isActive: true }
        });
        const notifications = teachers.map(teacher => ({
            userId: teacher.id,
            title: 'New Doubt Submitted',
            message: `A student has submitted a doubt in ${subject}`,
            type: 'INFO',
            actionUrl: `/doubts/${doubt.id}`
        }));
        await prisma.notification.createMany({
            data: notifications
        });
        res.status(201).json(doubt);
    }
    catch (error) {
        console.error('Create doubt error:', error);
        res.status(500).json({ error: 'Failed to create doubt' });
    }
});
// Update doubt status (teachers only)
router.put('/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.user;
        const { status } = req.body;
        if (role !== 'TEACHER' && role !== 'HEAD_TEACHER') {
            return res.status(403).json({ error: 'Only teachers can update doubt status' });
        }
        const doubt = await prisma.doubt.findUnique({
            where: { id },
            include: {
                student: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true
                    }
                }
            }
        });
        if (!doubt) {
            return res.status(404).json({ error: 'Doubt not found' });
        }
        const updatedDoubt = await prisma.doubt.update({
            where: { id },
            data: { status }
        });
        // Create notification for student
        await prisma.notification.create({
            data: {
                userId: doubt.studentId,
                title: 'Doubt Status Updated',
                message: `Your doubt \"${doubt.subject}\" status has been updated to ${status}`,
                type: 'INFO',
                actionUrl: `/doubts/${doubt.id}`
            }
        });
        res.json(updatedDoubt);
    }
    catch (error) {
        console.error('Update doubt status error:', error);
        res.status(500).json({ error: 'Failed to update doubt status' });
    }
});
// Schedule appointment for doubt (teachers only)
router.post('/:id/appointment', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { id: userId, role } = req.user;
        const { scheduledAt, duration, notes, meetingLink } = req.body;
        if (role !== 'TEACHER' && role !== 'HEAD_TEACHER') {
            return res.status(403).json({ error: 'Only teachers can schedule appointments' });
        }
        const doubt = await prisma.doubt.findUnique({
            where: { id },
            include: {
                student: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true
                    }
                }
            }
        });
        if (!doubt) {
            return res.status(404).json({ error: 'Doubt not found' });
        }
        // Check if appointment already exists
        const existingAppointment = await prisma.appointment.findUnique({
            where: { doubtId: id }
        });
        if (existingAppointment) {
            return res.status(400).json({ error: 'Appointment already exists for this doubt' });
        }
        const appointment = await prisma.appointment.create({
            data: {
                doubtId: id,
                teacherId: req.user.id,
                scheduledAt: new Date(scheduledAt),
                duration: duration || 30,
                notes,
                meetingLink
            },
            include: {
                teacher: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true
                    }
                },
                doubt: {
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
        // Update doubt status
        await prisma.doubt.update({
            where: { id },
            data: { status: 'IN_PROGRESS' }
        });
        // Create notification for student
        await prisma.notification.create({
            data: {
                userId: doubt.studentId,
                title: 'Appointment Scheduled',
                message: `Your appointment has been scheduled for ${new Date(scheduledAt).toLocaleString()}`,
                type: 'SUCCESS',
                actionUrl: `/appointments/${appointment.id}`
            }
        });
        res.status(201).json(appointment);
    }
    catch (error) {
        console.error('Schedule appointment error:', error);
        res.status(500).json({ error: 'Failed to schedule appointment' });
    }
});
// Get all appointments
router.get('/appointments', authenticateToken, async (req, res) => {
    try {
        const { id: userId, role } = req.user;
        const { status } = req.query;
        let whereCondition = {};
        if (role === 'STUDENT') {
            whereCondition = {
                doubt: {
                    studentId: userId
                }
            };
        }
        else if (role === 'TEACHER') {
            whereCondition.teacherId = userId;
        }
        if (status) {
            whereCondition.status = status;
        }
        const appointments = await prisma.appointment.findMany({
            where: whereCondition,
            include: {
                teacher: {
                    select: {
                        id: true,
                        fullName: true,
                        uid: true
                    }
                },
                doubt: {
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
            },
            orderBy: { scheduledAt: 'asc' }
        });
        res.json(appointments);
    }
    catch (error) {
        console.error('Get appointments error:', error);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});
// Update appointment status
router.put('/appointments/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { id: userId, role } = req.user;
        const { status, notes } = req.body;
        const appointment = await prisma.appointment.findUnique({
            where: { id },
            include: {
                doubt: {
                    include: {
                        student: true
                    }
                },
                teacher: true
            }
        });
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        // Check permissions
        if (role === 'STUDENT' && appointment.doubt.studentId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        else if (role === 'TEACHER' && appointment.teacherId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const updatedAppointment = await prisma.appointment.update({
            where: { id },
            data: {
                status,
                notes: notes || appointment.notes
            }
        });
        // Update doubt status based on appointment status
        if (status === 'COMPLETED') {
            await prisma.doubt.update({
                where: { id: appointment.doubtId },
                data: { status: 'RESOLVED' }
            });
        }
        // Create notification
        const notificationUserId = role === 'STUDENT' ? appointment.teacherId : appointment.doubt.studentId;
        await prisma.notification.create({
            data: {
                userId: notificationUserId,
                title: 'Appointment Updated',
                message: `Appointment status has been updated to ${status}`,
                type: 'INFO',
                actionUrl: `/appointments/${appointment.id}`
            }
        });
        res.json(updatedAppointment);
    }
    catch (error) {
        console.error('Update appointment error:', error);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});
// Delete doubt (students can delete their own pending doubts)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, role } = req.user;
        const doubt = await prisma.doubt.findUnique({
            where: { id },
            include: {
                appointment: true
            }
        });
        if (!doubt) {
            return res.status(404).json({ error: 'Doubt not found' });
        }
        // Check permissions
        if (role === 'STUDENT') {
            if (doubt.studentId !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (doubt.status !== 'PENDING') {
                return res.status(400).json({ error: 'Cannot delete doubt that is already being processed' });
            }
        }
        // Delete doubt (cascade will handle appointment)
        await prisma.doubt.delete({
            where: { id }
        });
        res.json({ message: 'Doubt deleted successfully' });
    }
    catch (error) {
        console.error('Delete doubt error:', error);
        res.status(500).json({ error: 'Failed to delete doubt' });
    }
});
export default router;
