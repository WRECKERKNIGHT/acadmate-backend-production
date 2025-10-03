import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();
const prisma = new PrismaClient();
// Get batch-wise results overview for teacher
router.get('/batch-overview', authenticateToken, async (req, res) => {
    try {
        const { uid, role } = req.user;
        if (role !== 'TEACHER' && role !== 'HEAD_TEACHER') {
            return res.status(403).json({ message: 'Access denied. Only teachers can view batch results.' });
        }
        // Get teacher's assigned batches
        const teacher = await prisma.user.findUnique({
            where: { uid },
            include: {
                batchesTeaching: true,
                testsCreated: {
                    include: {
                        submissions: {
                            include: {
                                student: {
                                    select: { uid: true, fullName: true, batchType: true }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }
        // Calculate batch-wise statistics
        const batchStats = teacher.batchesTeaching.map(batch => {
            const batchTests = teacher.testsCreated.filter(test => test.submissions.some(sub => sub.student.batchType === batch.type));
            const batchSubmissions = teacher.testsCreated.flatMap(test => test.submissions.filter(sub => sub.student.batchType === batch.type));
            const averageScore = batchSubmissions.length > 0
                ? batchSubmissions.reduce((sum, sub) => sum + sub.percentage, 0) / batchSubmissions.length
                : 0;
            const passedStudents = batchSubmissions.filter(sub => sub.percentage >= 40).length;
            const passRate = batchSubmissions.length > 0 ? (passedStudents / batchSubmissions.length) * 100 : 0;
            return {
                batch: {
                    id: batch.id,
                    type: batch.type,
                    name: batch.name
                },
                totalTests: batchTests.length,
                totalSubmissions: batchSubmissions.length,
                averageScore: Math.round(averageScore * 100) / 100,
                passRate: Math.round(passRate * 100) / 100,
                studentsCount: new Set(batchSubmissions.map(sub => sub.student.uid)).size
            };
        });
        res.json({
            teacher: {
                uid: teacher.uid,
                fullName: teacher.fullName,
                subjects: teacher.subjects
            },
            batchStats,
            totalTests: teacher.testsCreated.length,
            totalSubmissions: teacher.testsCreated.reduce((sum, test) => sum + test.submissions.length, 0)
        });
    }
    catch (error) {
        console.error('Error fetching batch overview:', error);
        res.status(500).json({ message: 'Failed to fetch batch results overview' });
    }
});
// Get detailed results for a specific batch
router.get('/batch/:batchId/detailed', authenticateToken, async (req, res) => {
    try {
        const { uid, role } = req.user;
        const { batchId } = req.params;
        if (role !== 'TEACHER' && role !== 'HEAD_TEACHER') {
            return res.status(403).json({ message: 'Access denied' });
        }
        // Verify teacher has access to this batch
        const teacher = await prisma.user.findUnique({
            where: { uid },
            include: { batchesTeaching: true }
        });
        if (role === 'TEACHER' && !teacher?.batchesTeaching.some(b => b.id === batchId)) {
            return res.status(403).json({ message: 'Access denied to this batch' });
        }
        // Get batch information
        const batch = await prisma.batch.findUnique({
            where: { id: batchId },
            include: {
                teachersAssigned: {
                    select: { uid: true, fullName: true, subjects: true }
                }
            }
        });
        if (!batch) {
            return res.status(404).json({ message: 'Batch not found' });
        }
        // Get all tests for this batch
        const tests = await prisma.test.findMany({
            where: {
                submissions: {
                    some: {
                        student: { batchType: batch.type }
                    }
                }
            },
            include: {
                author: {
                    select: { uid: true, fullName: true }
                },
                submissions: {
                    where: {
                        student: { batchType: batch.type }
                    },
                    include: {
                        student: {
                            select: { uid: true, fullName: true, batchType: true }
                        }
                    },
                    orderBy: { percentage: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        // Get all students in this batch with their overall performance
        const allStudents = await prisma.user.findMany({
            where: {
                batchType: batch.type,
                role: 'STUDENT'
            },
            include: {
                submissions: {
                    where: {
                        test: {
                            submissions: {
                                some: {
                                    student: { batchType: batch.type }
                                }
                            }
                        }
                    },
                    include: {
                        test: {
                            select: { id: true, title: true, totalMarks: true }
                        }
                    }
                }
            }
        });
        // Calculate student performance summary
        const studentPerformance = allStudents.map(student => {
            const submissions = student.submissions;
            const averageScore = submissions.length > 0
                ? submissions.reduce((sum, sub) => sum + sub.percentage, 0) / submissions.length
                : 0;
            const bestScore = submissions.length > 0
                ? Math.max(...submissions.map(sub => sub.percentage))
                : 0;
            const testsAttempted = submissions.length;
            const passedTests = submissions.filter(sub => sub.percentage >= 40).length;
            return {
                student: {
                    uid: student.uid,
                    fullName: student.fullName,
                    batchType: student.batchType
                },
                testsAttempted,
                passedTests,
                averageScore: Math.round(averageScore * 100) / 100,
                bestScore: Math.round(bestScore * 100) / 100,
                recentSubmissions: submissions
                    .sort((a, b) => new Date(b.submittedAt || b.createdAt).getTime() - new Date(a.submittedAt || a.createdAt).getTime())
                    .slice(0, 5)
            };
        }).sort((a, b) => b.averageScore - a.averageScore);
        res.json({
            batch,
            tests: tests.map(test => ({
                id: test.id,
                title: test.title,
                author: test.author,
                totalMarks: test.totalMarks,
                status: test.status,
                createdAt: test.createdAt,
                submissionsCount: test.submissions.length,
                averageScore: test.submissions.length > 0
                    ? Math.round((test.submissions.reduce((sum, sub) => sum + sub.percentage, 0) / test.submissions.length) * 100) / 100
                    : 0,
                topScore: test.submissions.length > 0
                    ? Math.max(...test.submissions.map(sub => sub.percentage))
                    : 0,
                submissions: test.submissions
            })),
            studentPerformance,
            summary: {
                totalStudents: allStudents.length,
                totalTests: tests.length,
                averageBatchScore: studentPerformance.length > 0
                    ? Math.round((studentPerformance.reduce((sum, student) => sum + student.averageScore, 0) / studentPerformance.length) * 100) / 100
                    : 0,
                topPerformer: studentPerformance[0] || null,
                studentsPassingRate: studentPerformance.length > 0
                    ? Math.round((studentPerformance.filter(s => s.averageScore >= 40).length / studentPerformance.length) * 100 * 100) / 100
                    : 0
            }
        });
    }
    catch (error) {
        console.error('Error fetching detailed batch results:', error);
        res.status(500).json({ message: 'Failed to fetch detailed batch results' });
    }
});
// Get subject-wise performance analysis
router.get('/batch/:batchId/subject-analysis', authenticateToken, async (req, res) => {
    try {
        const { uid, role } = req.user;
        const { batchId } = req.params;
        if (role !== 'TEACHER' && role !== 'HEAD_TEACHER') {
            return res.status(403).json({ message: 'Access denied' });
        }
        // Get batch
        const batch = await prisma.batch.findUnique({
            where: { id: batchId }
        });
        if (!batch) {
            return res.status(404).json({ message: 'Batch not found' });
        }
        // Get all tests for this batch grouped by subjects
        const tests = await prisma.test.findMany({
            where: {
                submissions: {
                    some: {
                        student: { batchType: batch.type }
                    }
                }
            },
            include: {
                author: {
                    select: { subjects: true }
                },
                submissions: {
                    where: {
                        student: { batchType: batch.type }
                    },
                    include: {
                        student: {
                            select: { uid: true, fullName: true }
                        }
                    }
                }
            }
        });
        // Group by subjects (inferred from test titles and teacher subjects)
        const subjectAnalysis = new Map();
        tests.forEach(test => {
            // Try to infer subject from test title or teacher subjects
            const possibleSubjects = test.author.subjects || [];
            let subject = 'General';
            // Simple subject detection based on keywords in title
            const title = test.title.toLowerCase();
            if (title.includes('math') || title.includes('algebra') || title.includes('geometry')) {
                subject = 'Mathematics';
            }
            else if (title.includes('physics')) {
                subject = 'Physics';
            }
            else if (title.includes('chemistry')) {
                subject = 'Chemistry';
            }
            else if (title.includes('biology')) {
                subject = 'Biology';
            }
            else if (title.includes('english')) {
                subject = 'English';
            }
            else if (possibleSubjects.length > 0) {
                subject = possibleSubjects[0];
            }
            if (!subjectAnalysis.has(subject)) {
                subjectAnalysis.set(subject, {
                    subject,
                    tests: [],
                    totalSubmissions: 0,
                    averageScore: 0,
                    topScore: 0,
                    studentsCount: new Set()
                });
            }
            const subjectData = subjectAnalysis.get(subject);
            subjectData.tests.push({
                id: test.id,
                title: test.title,
                submissionsCount: test.submissions.length,
                averageScore: test.submissions.length > 0
                    ? test.submissions.reduce((sum, sub) => sum + sub.percentage, 0) / test.submissions.length
                    : 0
            });
            subjectData.totalSubmissions += test.submissions.length;
            test.submissions.forEach(sub => {
                subjectData.studentsCount.add(sub.student.uid);
                if (sub.percentage > subjectData.topScore) {
                    subjectData.topScore = sub.percentage;
                }
            });
        });
        // Calculate final averages
        const subjectResults = Array.from(subjectAnalysis.values()).map(subject => {
            const allScores = subject.tests.flatMap(test => tests.find(t => t.id === test.id)?.submissions.map(sub => sub.percentage) || []);
            return {
                ...subject,
                studentsCount: subject.studentsCount.size,
                averageScore: allScores.length > 0
                    ? Math.round((allScores.reduce((sum, score) => sum + score, 0) / allScores.length) * 100) / 100
                    : 0,
                topScore: Math.round(subject.topScore * 100) / 100,
                testsCount: subject.tests.length
            };
        }).sort((a, b) => b.averageScore - a.averageScore);
        res.json({
            batch,
            subjectAnalysis: subjectResults,
            summary: {
                totalSubjects: subjectResults.length,
                bestPerformingSubject: subjectResults[0] || null,
                overallAverageScore: subjectResults.length > 0
                    ? Math.round((subjectResults.reduce((sum, sub) => sum + sub.averageScore, 0) / subjectResults.length) * 100) / 100
                    : 0
            }
        });
    }
    catch (error) {
        console.error('Error fetching subject analysis:', error);
        res.status(500).json({ message: 'Failed to fetch subject analysis' });
    }
});
// Get individual student performance details
router.get('/student/:studentUid/performance', authenticateToken, async (req, res) => {
    try {
        const { uid, role } = req.user;
        const { studentUid } = req.params;
        if (role !== 'TEACHER' && role !== 'HEAD_TEACHER') {
            return res.status(403).json({ message: 'Access denied' });
        }
        // Get student details
        const student = await prisma.user.findUnique({
            where: { uid: studentUid },
            include: {
                submissions: {
                    include: {
                        test: {
                            select: {
                                id: true,
                                title: true,
                                totalMarks: true,
                                createdAt: true,
                                author: {
                                    select: { uid: true, fullName: true, subjects: true }
                                }
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!student || student.role !== 'STUDENT') {
            return res.status(404).json({ message: 'Student not found' });
        }
        // Verify teacher has access to this student's batch
        if (role === 'TEACHER') {
            const teacher = await prisma.user.findUnique({
                where: { uid },
                include: { batchesTeaching: true }
            });
            const hasAccess = teacher?.batchesTeaching.some(batch => batch.type === student.batchType);
            if (!hasAccess) {
                return res.status(403).json({ message: 'Access denied to this student' });
            }
        }
        // Analyze performance
        const submissions = student.submissions;
        const performanceData = {
            student: {
                uid: student.uid,
                fullName: student.fullName,
                batchType: student.batchType
            },
            summary: {
                testsAttempted: submissions.length,
                averageScore: submissions.length > 0
                    ? Math.round((submissions.reduce((sum, sub) => sum + sub.percentage, 0) / submissions.length) * 100) / 100
                    : 0,
                bestScore: submissions.length > 0
                    ? Math.max(...submissions.map(sub => sub.percentage))
                    : 0,
                passedTests: submissions.filter(sub => sub.percentage >= 40).length,
                totalMarksObtained: submissions.reduce((sum, sub) => sum + sub.score, 0),
                totalPossibleMarks: submissions.reduce((sum, sub) => sum + sub.totalMarks, 0)
            },
            recentTests: submissions.slice(0, 10).map(submission => ({
                test: submission.test,
                score: submission.score,
                totalMarks: submission.totalMarks,
                percentage: submission.percentage,
                timeTaken: submission.timeTaken,
                submittedAt: submission.submittedAt,
                isCompleted: submission.isCompleted
            })),
            performanceTrend: submissions.slice(0, 20).reverse().map((submission, index) => ({
                testNumber: index + 1,
                testTitle: submission.test.title.substring(0, 20) + '...',
                percentage: submission.percentage,
                date: submission.submittedAt || submission.createdAt
            }))
        };
        res.json(performanceData);
    }
    catch (error) {
        console.error('Error fetching student performance:', error);
        res.status(500).json({ message: 'Failed to fetch student performance' });
    }
});
// Get comparative analysis between batches (HEAD_TEACHER only)
router.get('/comparative-analysis', authenticateToken, async (req, res) => {
    try {
        const { role } = req.user;
        if (role !== 'HEAD_TEACHER') {
            return res.status(403).json({ message: 'Access denied. Head teacher access required.' });
        }
        // Get all batches with their performance data
        const batches = await prisma.batch.findMany({
            include: {
                teachersAssigned: {
                    select: { uid: true, fullName: true, subjects: true }
                }
            }
        });
        const batchComparison = await Promise.all(batches.map(async (batch) => {
            // Get all students in this batch
            const students = await prisma.user.findMany({
                where: {
                    batchType: batch.type,
                    role: 'STUDENT'
                },
                include: {
                    submissions: {
                        include: {
                            test: {
                                select: { id: true, title: true, totalMarks: true }
                            }
                        }
                    }
                }
            });
            const allSubmissions = students.flatMap(student => student.submissions);
            const averageScore = allSubmissions.length > 0
                ? allSubmissions.reduce((sum, sub) => sum + sub.percentage, 0) / allSubmissions.length
                : 0;
            const testsCount = new Set(allSubmissions.map(sub => sub.test.id)).size;
            const passedSubmissions = allSubmissions.filter(sub => sub.percentage >= 40).length;
            const passRate = allSubmissions.length > 0 ? (passedSubmissions / allSubmissions.length) * 100 : 0;
            return {
                batch: {
                    id: batch.id,
                    type: batch.type,
                    name: batch.name
                },
                studentsCount: students.length,
                testsCount,
                totalSubmissions: allSubmissions.length,
                averageScore: Math.round(averageScore * 100) / 100,
                passRate: Math.round(passRate * 100) / 100,
                teachers: batch.teachersAssigned,
                topStudent: students.length > 0 ? students.reduce((top, student) => {
                    const studentAvg = student.submissions.length > 0
                        ? student.submissions.reduce((sum, sub) => sum + sub.percentage, 0) / student.submissions.length
                        : 0;
                    const topAvg = top.submissions.length > 0
                        ? top.submissions.reduce((sum, sub) => sum + sub.percentage, 0) / top.submissions.length
                        : 0;
                    return studentAvg > topAvg ? student : top;
                }) : null
            };
        }));
        // Sort by average score
        batchComparison.sort((a, b) => b.averageScore - a.averageScore);
        res.json({
            batchComparison,
            overallSummary: {
                totalBatches: batches.length,
                totalStudents: batchComparison.reduce((sum, batch) => sum + batch.studentsCount, 0),
                totalTests: batchComparison.reduce((sum, batch) => sum + batch.testsCount, 0),
                overallAverageScore: batchComparison.length > 0
                    ? Math.round((batchComparison.reduce((sum, batch) => sum + batch.averageScore, 0) / batchComparison.length) * 100) / 100
                    : 0,
                bestPerformingBatch: batchComparison[0] || null
            }
        });
    }
    catch (error) {
        console.error('Error fetching comparative analysis:', error);
        res.status(500).json({ message: 'Failed to fetch comparative analysis' });
    }
});
export default router;
