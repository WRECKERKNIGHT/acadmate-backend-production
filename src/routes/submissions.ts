import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Start a test (create submission)
router.post('/:testId/start', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { testId } = req.params;
    const { userId, role } = req.user!;
    
    if (role !== 'STUDENT') {
      return res.status(403).json({ error: 'Only students can take tests' });
    }
    
    // Check if test exists and is published
    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        sections: {
          include: {
            questions: true
          }
        },
        class: true
      }
    });
    
    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }
    
    if (test.status !== 'PUBLISHED') {
      return res.status(400).json({ error: 'Test is not available for taking' });
    }
    
    // Check if student has access to this test
    if (test.classId) {
      const hasAccess = await prisma.classStudent.findFirst({
        where: {
          studentId: userId,
          classId: test.classId
        }
      });
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied - you are not enrolled in this class' });
      }
    }
    
    // Check if student already has a submission for this test
    const existingSubmission = await prisma.submission.findUnique({
      where: {
        testId_studentId: {
          testId,
          studentId: userId
        }
      }
    });
    
    if (existingSubmission) {
      if (existingSubmission.isCompleted) {
        return res.status(400).json({ error: 'You have already completed this test' });
      }
      // Return existing submission if not completed
      return res.json(existingSubmission);
    }
    
    // Check time constraints
    const now = new Date();
    if (test.scheduledAt && now < test.scheduledAt) {
      return res.status(400).json({ error: 'Test has not started yet' });
    }
    
    if (test.endsAt && now > test.endsAt) {
      return res.status(400).json({ error: 'Test has ended' });
    }
    
    // Calculate total marks
    const totalMarks = test.sections.reduce((acc, section) => 
      acc + section.questions.reduce((qAcc, question) => qAcc + question.marks, 0), 0
    );
    
    // Create new submission
    const submission = await prisma.submission.create({
      data: {
        testId,
        studentId: userId,
        answers: {},
        totalMarks,
        startedAt: new Date()
      }
    });
    
    res.status(201).json(submission);
  } catch (error) {
    console.error('Start test error:', error);
    res.status(500).json({ error: 'Failed to start test' });
  }
});

// Save answer for a question
router.post('/:testId/answer', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { testId } = req.params;
    const { userId, role } = req.user!;
    const { questionId, answer } = req.body;
    
    if (role !== 'STUDENT') {
      return res.status(403).json({ error: 'Only students can submit answers' });
    }
    
    // Get submission
    const submission = await prisma.submission.findUnique({
      where: {
        testId_studentId: {
          testId,
          studentId: userId
        }
      }
    });
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found. Please start the test first.' });
    }
    
    if (submission.isCompleted) {
      return res.status(400).json({ error: 'Test is already completed' });
    }
    
    // Update answers
    const answers = submission.answers as Record<string, any>;
    answers[questionId] = answer;
    
    const updatedSubmission = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        answers
      }
    });
    
    res.json(updatedSubmission);
  } catch (error) {
    console.error('Save answer error:', error);
    res.status(500).json({ error: 'Failed to save answer' });
  }
});

// Submit test (complete submission)
router.post('/:testId/submit', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { testId } = req.params;
    const { userId, role } = req.user!;
    
    if (role !== 'STUDENT') {
      return res.status(403).json({ error: 'Only students can submit tests' });
    }
    
    // Get submission with test data
    const submission = await prisma.submission.findUnique({
      where: {
        testId_studentId: {
          testId,
          studentId: userId
        }
      },
      include: {
        test: {
          include: {
            sections: {
              include: {
                questions: {
                  orderBy: { order: 'asc' }
                }
              },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    if (submission.isCompleted) {
      return res.status(400).json({ error: 'Test is already completed' });
    }
    
    // Calculate score
    let totalScore = 0;
    const answers = submission.answers as Record<string, any>;
    
    for (const section of submission.test.sections) {
      for (const question of section.questions) {
        const studentAnswer = answers[question.id];
        if (studentAnswer) {
          const isCorrect = checkAnswer(question, studentAnswer);
          if (isCorrect) {
            totalScore += question.marks;
          } else {
            totalScore -= question.negativeMarks;
          }
        }
      }
    }
    
    // Ensure score is not negative
    totalScore = Math.max(0, totalScore);
    
    // Calculate percentage
    const percentage = submission.totalMarks > 0 ? (totalScore / submission.totalMarks) * 100 : 0;
    
    // Calculate time taken
    const timeTaken = Math.floor((new Date().getTime() - submission.startedAt.getTime()) / (1000 * 60));
    
    // Update submission
    const completedSubmission = await prisma.submission.update({
      where: { id: submission.id },
      data: {
        score: totalScore,
        percentage,
        timeTaken,
        isCompleted: true,
        submittedAt: new Date()
      },
      include: {
        test: {
          select: {
            title: true,
            totalMarks: true,
            duration: true,
            showResults: true
          }
        }
      }
    });
    
    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        title: 'Test Completed',
        message: `You have successfully completed "${submission.test.title}". Score: ${totalScore}/${submission.totalMarks}`,
        type: 'SUCCESS'
      }
    });
    
    res.json(completedSubmission);
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(500).json({ error: 'Failed to submit test' });
  }
});

// Get submission details
router.get('/:testId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { testId } = req.params;
    const { userId, role } = req.user!;
    
    if (role === 'STUDENT') {
      const submission = await prisma.submission.findUnique({
        where: {
          testId_studentId: {
            testId,
            studentId: userId
          }
        },
        include: {
          test: {
            include: {
              sections: {
                include: {
                  questions: {
                    orderBy: { order: 'asc' }
                  }
                },
                orderBy: { order: 'asc' }
              }
            }
          }
        }
      });
      
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }
      
      // Hide correct answers unless test is completed and allows review
      if (!submission.isCompleted || !submission.test.allowReview) {
        submission.test.sections.forEach(section => {
          section.questions.forEach(question => {
            // Hide correct answers and explanations for ongoing tests
            question.correctAnswers = undefined;
            question.explanation = undefined;
          });
        });
      }
      
      res.json(submission);
    } else {
      // Teachers can see all submissions for their tests
      const test = await prisma.test.findFirst({
        where: {
          id: testId,
          authorId: userId
        }
      });
      
      if (!test) {
        return res.status(404).json({ error: 'Test not found or access denied' });
      }
      
      const submissions = await prisma.submission.findMany({
        where: { testId },
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              uid: true
            }
          }
        },
        orderBy: { submittedAt: 'desc' }
      });
      
      res.json(submissions);
    }
  } catch (error) {
    console.error('Get submission error:', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// Get detailed results (for completed submissions)
router.get('/:testId/results', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { testId } = req.params;
    const { userId, role } = req.user!;
    
    const submission = await prisma.submission.findUnique({
      where: {
        testId_studentId: {
          testId,
          studentId: userId
        }
      },
      include: {
        test: {
          include: {
            sections: {
              include: {
                questions: {
                  orderBy: { order: 'asc' }
                }
              },
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    if (!submission.isCompleted) {
      return res.status(400).json({ error: 'Test is not completed yet' });
    }
    
    if (!submission.test.showResults) {
      return res.status(403).json({ error: 'Results are not available for this test' });
    }
    
    // Generate detailed analysis
    const answers = submission.answers as Record<string, any>;
    const analysis = {
      submission,
      questionAnalysis: submission.test.sections.map(section => ({
        section,
        questions: section.questions.map(question => {
          const studentAnswer = answers[question.id];
          const isCorrect = studentAnswer ? checkAnswer(question, studentAnswer) : false;
          const scoreObtained = isCorrect ? question.marks : (studentAnswer ? -question.negativeMarks : 0);
          
          return {
            question,
            studentAnswer,
            isCorrect,
            scoreObtained,
            explanation: question.explanation
          };
        })
      }))
    };
    
    res.json(analysis);
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Helper function to check if an answer is correct
function checkAnswer(question: any, studentAnswer: any): boolean {
  const correctAnswers = question.correctAnswers;
  
  if (question.type === 'MCQ') {
    return correctAnswers.includes(studentAnswer);
  } else if (question.type === 'INTEGER') {
    return correctAnswers.includes(String(studentAnswer));
  } else if (question.type === 'SHORT_ANSWER') {
    // For short answers, we can do case-insensitive comparison
    const studentAnswerLower = String(studentAnswer).toLowerCase().trim();
    return correctAnswers.some((answer: any) =>
      String(answer).toLowerCase().trim() === studentAnswerLower
    );
  }
  
  return false;
}

export default router;

