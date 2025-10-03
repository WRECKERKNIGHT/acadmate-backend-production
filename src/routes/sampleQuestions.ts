import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/sample-questions - Get sample questions with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { subject, class: classLevel, difficulty, type, tags, limit = '50' } = req.query;
    
    const where: any = {};
    
    if (subject) where.subject = subject;
    if (classLevel) where.class = classLevel;
    if (difficulty) where.difficulty = difficulty;
    if (type) where.type = type;
    
    if (tags) {
      // Search in tags JSON field
      where.tags = {
        contains: tags as string
      };
    }

    const questions = await prisma.sampleQuestion.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Parse JSON fields
    const formattedQuestions = questions.map(q => ({
      ...q,
      options: JSON.parse(q.options),
      correctAnswers: JSON.parse(q.correctAnswers),
      tags: JSON.parse(q.tags)
    }));

    res.json(formattedQuestions);
  } catch (error) {
    console.error('Error fetching sample questions:', error);
    res.status(500).json({ error: 'Failed to fetch sample questions' });
  }
});

// GET /api/sample-questions/subjects - Get available subjects
router.get('/subjects', authenticateToken, async (req, res) => {
  try {
    const subjects = await prisma.sampleQuestion.findMany({
      select: { subject: true },
      distinct: ['subject']
    });

    res.json(subjects.map(s => s.subject));
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// GET /api/sample-questions/classes - Get available classes
router.get('/classes', authenticateToken, async (req, res) => {
  try {
    const classes = await prisma.sampleQuestion.findMany({
      select: { class: true },
      distinct: ['class']
    });

    res.json(classes.map(c => c.class).sort());
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// GET /api/sample-questions/stats - Get question statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const total = await prisma.sampleQuestion.count();
    
    const bySubject = await prisma.sampleQuestion.groupBy({
      by: ['subject'],
      _count: { id: true }
    });

    const byClass = await prisma.sampleQuestion.groupBy({
      by: ['class'],
      _count: { id: true }
    });

    const byDifficulty = await prisma.sampleQuestion.groupBy({
      by: ['difficulty'],
      _count: { id: true }
    });

    const byType = await prisma.sampleQuestion.groupBy({
      by: ['type'],
      _count: { id: true }
    });

    res.json({
      total,
      bySubject: bySubject.reduce((acc, item) => {
        acc[item.subject] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      byClass: byClass.reduce((acc, item) => {
        acc[item.class] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      byDifficulty: byDifficulty.reduce((acc, item) => {
        acc[item.difficulty] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      }, {} as Record<string, number>)
    });
  } catch (error) {
    console.error('Error fetching question stats:', error);
    res.status(500).json({ error: 'Failed to fetch question statistics' });
  }
});

// POST /api/sample-questions - Create new sample question (Admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { subject, class: classLevel, type, text, imageUrl, options, correctAnswers, explanation, difficulty, tags } = req.body;

    if (req.user.role !== 'TEACHER' && req.user.role !== 'HEAD_TEACHER') {
      return res.status(403).json({ error: 'Only teachers can create sample questions' });
    }

    const question = await prisma.sampleQuestion.create({
      data: {
        subject,
        class: classLevel,
        type,
        text,
        imageUrl,
        options: JSON.stringify(options || []),
        correctAnswers: JSON.stringify(correctAnswers || []),
        explanation,
        difficulty: difficulty || 'MEDIUM',
        tags: JSON.stringify(tags || [])
      }
    });

    res.status(201).json({
      ...question,
      options: JSON.parse(question.options),
      correctAnswers: JSON.parse(question.correctAnswers),
      tags: JSON.parse(question.tags)
    });
  } catch (error) {
    console.error('Error creating sample question:', error);
    res.status(500).json({ error: 'Failed to create sample question' });
  }
});

// GET /api/sample-questions/:id - Get specific sample question
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const question = await prisma.sampleQuestion.findUnique({
      where: { id }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({
      ...question,
      options: JSON.parse(question.options),
      correctAnswers: JSON.parse(question.correctAnswers),
      tags: JSON.parse(question.tags)
    });
  } catch (error) {
    console.error('Error fetching sample question:', error);
    res.status(500).json({ error: 'Failed to fetch sample question' });
  }
});

// DELETE /api/sample-questions/:id - Delete sample question (Admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'HEAD_TEACHER') {
      return res.status(403).json({ error: 'Only head teachers can delete sample questions' });
    }

    await prisma.sampleQuestion.delete({
      where: { id }
    });

    res.json({ message: 'Sample question deleted successfully' });
  } catch (error) {
    console.error('Error deleting sample question:', error);
    res.status(500).json({ error: 'Failed to delete sample question' });
  }
});

export default router;

