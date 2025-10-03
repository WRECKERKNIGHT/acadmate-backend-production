import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth.js';
const router = express.Router();
const prisma = new PrismaClient();
// Get all tests (for teachers) or available tests (for students)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { role } = req.user;
        if (role === 'TEACHER') {
            const tests = await prisma.test.findMany({
                where: { authorId: req.user.userId },
                include: {
                    sections: {
                        include: {
                            questions: true
                        }
                    },
                    submissions: true,
                    class: true
                },
                orderBy: { createdAt: 'desc' }
            });
            const testsWithStats = tests.map(test => ({
                ...test,
                questionsCount: test.sections.reduce((acc, section) => acc + section.questions.length, 0),
                submissionsCount: test.submissions.length
            }));
            res.json(testsWithStats);
        }
        else {
            // Student: get published tests for their classes
            const studentClasses = await prisma.classStudent.findMany({
                where: { studentId: req.user.id },
                include: {
                    class: {
                        include: {
                            tests: {
                                where: { status: 'PUBLISHED' },
                                include: {
                                    sections: {
                                        include: {
                                            questions: true
                                        }
                                    },
                                    submissions: {
                                        where: { studentId: req.user.id }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            const tests = studentClasses.flatMap(cs => cs.class.tests.map(test => ({
                ...test,
                questionsCount: test.sections.reduce((acc, section) => acc + section.questions.length, 0),
                isAttempted: test.submissions.length > 0,
                submission: test.submissions[0] || null
            })));
            res.json(tests);
        }
    }
    catch (error) {
        console.error('Get tests error:', error);
        res.status(500).json({ error: 'Failed to fetch tests' });
    }
});
// Get single test by ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { role, id: userId } = req.user;
        const test = await prisma.test.findUnique({
            where: { id },
            include: {
                sections: {
                    include: {
                        questions: {
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' }
                },
                author: {
                    select: { id: true, fullName: true, uid: true }
                },
                class: true,
                submissions: role === 'STUDENT' ? {
                    where: { studentId: userId }
                } : true
            }
        });
        if (!test) {
            return res.status(404).json({ error: 'Test not found' });
        }
        // Check permissions
        if (role === 'STUDENT') {
            // Check if student has access to this test
            if (test.classId) {
                const hasAccess = await prisma.classStudent.findFirst({
                    where: {
                        studentId: userId,
                        classId: test.classId
                    }
                });
                if (!hasAccess) {
                    return res.status(403).json({ error: 'Access denied' });
                }
            }
            // Don't show correct answers to students unless they've completed the test
            const submission = test.submissions && test.submissions.length > 0 ? test.submissions[0] : null;
            const hideAnswers = !submission || !submission.isCompleted;
            if (hideAnswers) {
                test.sections?.forEach((section) => {
                    section.questions?.forEach((question) => {
                        delete question.correctAnswers;
                        delete question.explanation;
                    });
                });
            }
        }
        res.json(test);
    }
    catch (error) {
        console.error('Get test error:', error);
        res.status(500).json({ error: 'Failed to fetch test' });
    }
});
// Create new test (teachers only)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, description, classId, duration, totalMarks, passingMarks, instructions, scheduledAt, endsAt, allowReview, shuffleQuestions, showResults, sections } = req.body;
        if (req.user.role !== 'TEACHER' && req.user.role !== 'HEAD_TEACHER') {
            return res.status(403).json({ error: 'Only teachers can create tests' });
        }
        // Start transaction
        const result = await prisma.$transaction(async (prisma) => {
            // Create test
            const test = await prisma.test.create({
                data: {
                    title,
                    description,
                    classId,
                    authorId: req.user.id,
                    duration: duration || 180,
                    totalMarks: totalMarks || 0,
                    passingMarks: passingMarks || 0,
                    instructions,
                    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                    endsAt: endsAt ? new Date(endsAt) : null,
                    allowReview: allowReview ?? true,
                    shuffleQuestions: shuffleQuestions ?? false,
                    showResults: showResults ?? true,
                    status: 'DRAFT'
                }
            });
            // Create sections and questions if provided
            if (sections && sections.length > 0) {
                for (const [sectionIndex, sectionData] of sections.entries()) {
                    const section = await prisma.section.create({
                        data: {
                            title: sectionData.title,
                            description: sectionData.description,
                            testId: test.id,
                            order: sectionIndex + 1,
                            timeLimit: sectionData.timeLimit
                        }
                    });
                    // Create questions for this section
                    if (sectionData.questions && sectionData.questions.length > 0) {
                        for (const [questionIndex, questionData] of sectionData.questions.entries()) {
                            await prisma.question.create({
                                data: {
                                    sectionId: section.id,
                                    type: questionData.type,
                                    text: questionData.text,
                                    imageUrl: questionData.imageUrl,
                                    options: JSON.stringify(questionData.options || []),
                                    correctAnswers: JSON.stringify(questionData.correctAnswers || []),
                                    explanation: questionData.explanation,
                                    marks: questionData.marks || 1,
                                    negativeMarks: questionData.negativeMarks || 0,
                                    difficulty: questionData.difficulty || 'MEDIUM',
                                    order: questionIndex + 1,
                                    tags: JSON.stringify(questionData.tags || [])
                                }
                            });
                        }
                    }
                }
            }
            return test;
        });
        // Fetch complete test with sections and questions
        const completeTest = await prisma.test.findUnique({
            where: { id: result.id },
            include: {
                sections: {
                    include: {
                        questions: {
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' }
                },
                class: true
            }
        });
        res.status(201).json(completeTest);
    }
    catch (error) {
        console.error('Create test error:', error);
        res.status(500).json({ error: 'Failed to create test' });
    }
});
// Update test (teachers only)
router.put('/:id', authenticateToken, requireRole('TEACHER'), async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.user;
        // Check if test belongs to the teacher
        const existingTest = await prisma.test.findFirst({
            where: { id, authorId: userId }
        });
        if (!existingTest) {
            return res.status(404).json({ error: 'Test not found or access denied' });
        }
        const updatedTest = await prisma.test.update({
            where: { id },
            data: {
                ...req.body,
                scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
                endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null
            },
            include: {
                sections: {
                    include: {
                        questions: true
                    }
                },
                class: true
            }
        });
        res.json(updatedTest);
    }
    catch (error) {
        console.error('Update test error:', error);
        res.status(500).json({ error: 'Failed to update test' });
    }
});
// Publish test (teachers only)
router.post('/:id/publish', authenticateToken, requireRole('TEACHER'), async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.user;
        // Check if test belongs to the teacher and has questions
        const test = await prisma.test.findFirst({
            where: { id, authorId: userId },
            include: {
                sections: {
                    include: {
                        questions: true
                    }
                }
            }
        });
        if (!test) {
            return res.status(404).json({ error: 'Test not found or access denied' });
        }
        const totalQuestions = test.sections.reduce((acc, section) => acc + section.questions.length, 0);
        if (totalQuestions === 0) {
            return res.status(400).json({ error: 'Cannot publish test without questions' });
        }
        // Calculate total marks
        const totalMarks = test.sections.reduce((acc, section) => acc + section.questions.reduce((qAcc, question) => qAcc + question.marks, 0), 0);
        const updatedTest = await prisma.test.update({
            where: { id },
            data: {
                status: 'PUBLISHED',
                totalMarks
            }
        });
        res.json(updatedTest);
    }
    catch (error) {
        console.error('Publish test error:', error);
        res.status(500).json({ error: 'Failed to publish test' });
    }
});
// Delete test (teachers only)
router.delete('/:id', authenticateToken, requireRole('TEACHER'), async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.user;
        // Check if test belongs to the teacher
        const test = await prisma.test.findFirst({
            where: { id, authorId: userId }
        });
        if (!test) {
            return res.status(404).json({ error: 'Test not found or access denied' });
        }
        // Delete test (cascade will handle sections and questions)
        await prisma.test.delete({
            where: { id }
        });
        res.json({ message: 'Test deleted successfully' });
    }
    catch (error) {
        console.error('Delete test error:', error);
        res.status(500).json({ error: 'Failed to delete test' });
    }
});
export default router;
