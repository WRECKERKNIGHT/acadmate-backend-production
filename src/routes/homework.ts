import express from 'express';
import { auth } from '../middleware/auth';
import homeworkController, { upload } from '../controllers/homeworkController';

const router = express.Router();

// All homework routes require authentication
router.use(auth);

// Create homework assignment (Teachers and Head Teachers only)
router.post('/', upload.single('homeworkFile'), (req, res, next) => {
  if (req.user?.role !== 'TEACHER' && req.user?.role !== 'HEAD_TEACHER') {
    return res.status(403).json({ error: 'Only teachers can create homework assignments' });
  }
  next();
}, homeworkController.createHomework);

// Get homework assignments
router.get('/', homeworkController.getHomeworkAssignments);

// Get homework statistics
router.get('/statistics', homeworkController.getHomeworkStatistics);

// Get student's own homework submissions (Students only)
router.get('/my-submissions', (req, res, next) => {
  if (req.user?.role !== 'STUDENT') {
    return res.status(403).json({ error: 'Only students can access their submissions' });
  }
  next();
}, homeworkController.getStudentHomeworkSubmissions);

// Get specific homework by ID
router.get('/:id', homeworkController.getHomeworkById);

// Submit homework (Students only)
router.post('/:id/submit', upload.single('submissionFile'), (req, res, next) => {
  if (req.user?.role !== 'STUDENT') {
    return res.status(403).json({ error: 'Only students can submit homework' });
  }
  req.body.homeworkId = req.params.id;
  next();
}, homeworkController.submitHomework);

// Grade homework submission (Teachers and Head Teachers only)
router.put('/submissions/:submissionId/grade', (req, res, next) => {
  if (req.user?.role !== 'TEACHER' && req.user?.role !== 'HEAD_TEACHER') {
    return res.status(403).json({ error: 'Only teachers can grade homework' });
  }
  next();
}, homeworkController.gradeHomeworkSubmission);

export default router;