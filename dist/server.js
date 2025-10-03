import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth.js';
import testRoutes from './routes/tests.js';
import sectionRoutes from './routes/sections.js';
import submissionRoutes from './routes/submissions.js';
import doubtRoutes from './routes/doubts.js';
import classRoutes from './routes/classes.js';
import scheduleRoutes from './routes/schedule.js';
import notificationRoutes from './routes/notifications.js';
import eventsRoutes from './routes/events.js';
import resultsRoutes from './routes/results.js';
import sampleQuestionsRoutes from './routes/sampleQuestions.js';
import uploadRoutes from './routes/upload.js';
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Serve static files for uploaded images
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.get('/health', (_req, res) => {
    res.json({ ok: true });
});
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/doubts', doubtRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/sample-questions', sampleQuestionsRoutes);
app.use('/api/upload', uploadRoutes);
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`);
});
