import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Create new section for a test
router.post('/', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { testId, title, description, order, timeLimit } = req.body;
    const { userId } = req.user!;
    
    // Verify test ownership
    const test = await prisma.test.findFirst({
      where: { id: testId, authorId: userId }
    });
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found or access denied' });
    }
    
    const section = await prisma.section.create({
      data: {
        title,
        description,
        testId,
        order,
        timeLimit
      },
      include: {
        questions: true
      }
    });
    
    res.status(201).json(section);
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// Update section
router.put('/:id', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user!;
    
    // Verify section ownership through test
    const section = await prisma.section.findFirst({
      where: { 
        id,
        test: { authorId: userId }
      }
    });
    
    if (!section) {
      return res.status(404).json({ error: 'Section not found or access denied' });
    }
    
    const updatedSection = await prisma.section.update({
      where: { id },
      data: req.body,
      include: {
        questions: {
          orderBy: { order: 'asc' }
        }
      }
    });
    
    res.json(updatedSection);
  } catch (error) {
    console.error('Update section error:', error);
    res.status(500).json({ error: 'Failed to update section' });
  }
});

// Delete section
router.delete('/:id', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user!;
    
    // Verify section ownership through test
    const section = await prisma.section.findFirst({
      where: { 
        id,
        test: { authorId: userId }
      }
    });
    
    if (!section) {
      return res.status(404).json({ error: 'Section not found or access denied' });
    }
    
    await prisma.section.delete({
      where: { id }
    });
    
    res.json({ message: 'Section deleted successfully' });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

// Add question to section
router.post('/:sectionId/questions', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { sectionId } = req.params;
    const { userId } = req.user!;
    const {
      type,
      text,
      imageUrl,
      options,
      correctAnswers,
      explanation,
      marks,
      negativeMarks,
      difficulty,
      order,
      tags
    } = req.body;
    
    // Verify section ownership through test
    const section = await prisma.section.findFirst({
      where: { 
        id: sectionId,
        test: { authorId: userId }
      }
    });
    
    if (!section) {
      return res.status(404).json({ error: 'Section not found or access denied' });
    }
    
    const question = await prisma.question.create({
      data: {
        sectionId,
        type,
        text,
        imageUrl,
        options,
        correctAnswers,
        explanation,
        marks,
        negativeMarks: negativeMarks || 0,
        difficulty: difficulty || 'MEDIUM',
        order,
        tags: tags || []
      }
    });
    
    res.status(201).json(question);
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// Update question
router.put('/:sectionId/questions/:questionId', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { questionId } = req.params;
    const { userId } = req.user!;
    
    // Verify question ownership through test
    const question = await prisma.question.findFirst({
      where: { 
        id: questionId,
        section: {
          test: { authorId: userId }
        }
      }
    });
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found or access denied' });
    }
    
    const updatedQuestion = await prisma.question.update({
      where: { id: questionId },
      data: req.body
    });
    
    res.json(updatedQuestion);
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete question
router.delete('/:sectionId/questions/:questionId', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { questionId } = req.params;
    const { userId } = req.user!;
    
    // Verify question ownership through test
    const question = await prisma.question.findFirst({
      where: { 
        id: questionId,
        section: {
          test: { authorId: userId }
        }
      }
    });
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found or access denied' });
    }
    
    await prisma.question.delete({
      where: { id: questionId }
    });
    
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Bulk import questions
router.post('/:sectionId/questions/bulk', authenticateToken, requireRole('TEACHER'), async (req: AuthRequest, res) => {
  try {
    const { sectionId } = req.params;
    const { userId } = req.user!;
    const { questions } = req.body;
    
    // Verify section ownership
    const section = await prisma.section.findFirst({
      where: { 
        id: sectionId,
        test: { authorId: userId }
      }
    });
    
    if (!section) {
      return res.status(404).json({ error: 'Section not found or access denied' });
    }
    
    const createdQuestions = await Promise.all(
      questions.map((questionData: any, index: number) =>
        prisma.question.create({
          data: {
            sectionId,
            type: questionData.type,
            text: questionData.text,
            imageUrl: questionData.imageUrl,
            options: questionData.options || [],
            correctAnswers: questionData.correctAnswers || [],
            explanation: questionData.explanation,
            marks: questionData.marks,
            negativeMarks: questionData.negativeMarks || 0,
            difficulty: questionData.difficulty || 'MEDIUM',
            order: questionData.order || index + 1,
            tags: questionData.tags || []
          }
        })
      )
    );
    
    res.status(201).json(createdQuestions);
  } catch (error) {
    console.error('Bulk import questions error:', error);
    res.status(500).json({ error: 'Failed to import questions' });
  }
});

export default router;

