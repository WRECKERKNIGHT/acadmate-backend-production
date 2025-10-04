import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'ACADMATE Backend',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'connected',
      uptime: process.uptime()
    };
    
    res.status(200).json(healthCheck);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'ACADMATE Backend',
      database: 'disconnected',
      error: 'Service unavailable'
    });
  }
});

// Detailed health check for monitoring
router.get('/detailed', async (req, res) => {
  try {
    // Check database connection and get stats
    const userCount = await prisma.user.count();
    const classCount = await prisma.classSchedule.count();
    
    const detailedHealth = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'ACADMATE Backend',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        users: userCount,
        classes: classCount
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
    
    res.status(200).json(detailedHealth);
  } catch (error) {
    console.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      service: 'ACADMATE Backend',
      database: { status: 'disconnected' },
      error: 'Service unavailable'
    });
  }
});

export default router;
