import express from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import authRoutes from './routes/auth.js';
import testRoutes from './routes/tests.js';
import sectionRoutes from './routes/sections.js';
import submissionRoutes from './routes/submissions.js';
import doubtRoutes from './routes/doubts.js';
import classRoutes from './routes/classes.js';
import scheduleRoutes from './routes/schedule.js';
import schedulingRoutes from './routes/scheduling.js';
import attendanceRoutes from './routes/attendance.js';
import notificationRoutes from './routes/notifications.js';
import eventsRoutes from './routes/events.js';
import resultsRoutes from './routes/results.js';
import sampleQuestionsRoutes from './routes/sampleQuestions.js';
import uploadRoutes from './routes/upload.js';
import homeworkRoutes from './routes/homework.js';
import adminRoutes from './routes/admin.js';
import leaderboardRoutes from './routes/leaderboard.js';
import healthRoutes from './routes/health.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check routes
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/doubts', doubtRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/sample-questions', sampleQuestionsRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/upload', uploadRoutes);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
