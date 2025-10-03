import express from 'express';
import { auth } from '../middleware/auth.js';
import * as leaderboardController from '../controllers/leaderboardController.js';

const router = express.Router();

// Monthly leaderboard routes
router.get('/monthly', auth, leaderboardController.getMonthlyLeaderboard);

// Test-specific leaderboard routes  
router.get('/tests', auth, leaderboardController.getTestLeaderboards);

// Overall platform leaderboard routes
router.get('/overall', auth, leaderboardController.getOverallLeaderboard);

// User personal stats
router.get('/user/:userId/stats', auth, leaderboardController.getUserLeaderboardStats);

export default router;
