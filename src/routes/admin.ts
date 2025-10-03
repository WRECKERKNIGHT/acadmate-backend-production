import express from 'express';
import { auth } from '../middleware/auth';
import adminController from '../controllers/adminController';

const router = express.Router();

// All admin routes require authentication and HEAD_TEACHER role
router.use(auth);
router.use((req, res, next) => {
  if (req.user?.role !== 'HEAD_TEACHER') {
    return res.status(403).json({ error: 'Access denied. Head Teacher privileges required.' });
  }
  next();
});

// User Management Routes
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.post('/users', adminController.createUser);
router.put('/users/:userId', adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);
router.post('/users/bulk', adminController.bulkUserOperations);

// Teacher Management Routes
router.get('/teachers/activities', adminController.getTeacherActivities);
router.put('/teachers/:teacherId/batch', adminController.changeTeacherBatch);

// Admin Dashboard Statistics
router.get('/statistics', adminController.getAdminStatistics);

export default router;