import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Educational Test Platform Backend is running!',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 5000
  });
});

// Test database connection
app.get('/api/db-test', async (_req, res) => {
  try {
    const questionCount = await prisma.sampleQuestion.count();
    res.json({ 
      status: 'connected', 
      sampleQuestionsCount: questionCount,
      message: 'Database is working!'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Simple sample questions endpoint for testing
app.get('/api/sample-questions', async (req, res) => {
  try {
    const { limit = '10', subject, class: classLevel } = req.query;
    
    const where: any = {};
    if (subject) where.subject = subject;
    if (classLevel) where.class = classLevel;

    const questions = await prisma.sampleQuestion.findMany({
      where,
      take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' }
    });

    // Parse JSON fields
    const formattedQuestions = questions.map(q => ({
      ...q,
      options: JSON.parse(q.options),
      correctAnswers: JSON.parse(q.correctAnswers),
      tags: JSON.parse(q.tags)
    }));

    res.json({
      success: true,
      count: formattedQuestions.length,
      data: formattedQuestions
    });
  } catch (error) {
    console.error('Error fetching sample questions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch sample questions' 
    });
  }
});

// Get available subjects
app.get('/api/subjects', async (_req, res) => {
  try {
    const subjects = await prisma.sampleQuestion.findMany({
      select: { subject: true },
      distinct: ['subject']
    });

    res.json({
      success: true,
      subjects: subjects.map(s => s.subject)
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch subjects' 
    });
  }
});

// Get statistics
app.get('/api/stats', async (_req, res) => {
  try {
    const totalQuestions = await prisma.sampleQuestion.count();
    
    const subjectStats = await prisma.sampleQuestion.groupBy({
      by: ['subject'],
      _count: { id: true }
    });

    const difficultyStats = await prisma.sampleQuestion.groupBy({
      by: ['difficulty'],
      _count: { id: true }
    });

    res.json({
      success: true,
      stats: {
        totalQuestions,
        bySubject: subjectStats.reduce((acc, item) => {
          acc[item.subject] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byDifficulty: difficultyStats.reduce((acc, item) => {
          acc[item.difficulty] = item._count.id;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch statistics' 
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: `Route ${req.method} ${req.path} not found` 
  });
});

const port = process.env.PORT || 5000;

const server = app.listen(port, () => {
  console.log(`🚀 Educational Test Platform Backend Server Started!`);
  console.log(`📍 Server URL: http://localhost:${port}`);
  console.log(`🏥 Health Check: http://localhost:${port}/health`);
  console.log(`🔧 Database Test: http://localhost:${port}/api/db-test`);
  console.log(`📚 Sample Questions: http://localhost:${port}/api/sample-questions`);
  console.log(`📊 Statistics: http://localhost:${port}/api/stats`);
  console.log(`📖 Available Subjects: http://localhost:${port}/api/subjects`);
  console.log(`\n✅ Ready for frontend connections!`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server shutdown complete');
    process.exit(0);
  });
  await prisma.$disconnect();
});

export default app;
