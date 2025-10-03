import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

// Get monthly leaderboard
export const getMonthlyLeaderboard = async (req: Request, res: Response) => {
  try {
    const { batch, month = new Date().toISOString().slice(0, 7) } = req.query
    
    // Parse month (YYYY-MM format)
    const startDate = new Date(`${month}-01`)
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
    
    let whereClause = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    }
    
    if (batch) {
      whereClause.user = {
        batchType: batch
      }
    }

    // Get all test submissions for the month
    const submissions = await prisma.submission.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            fullName: true,
            batchType: true
          }
        },
        test: {
          select: {
            totalMarks: true
          }
        }
      }
    })

    // Calculate user statistics
    const userStats = {}
    
    submissions.forEach(submission => {
      const userId = submission.userId
      const percentage = submission.test.totalMarks > 0 
        ? Math.round((submission.score / submission.test.totalMarks) * 100)
        : 0
      
      if (!userStats[userId]) {
        userStats[userId] = {
          user: submission.user,
          scores: [],
          totalTests: 0,
          totalScore: 0,
          streak: 0,
          lastTestDate: null
        }
      }
      
      userStats[userId].scores.push(percentage)
      userStats[userId].totalTests++
      userStats[userId].totalScore += submission.score
      userStats[userId].lastTestDate = submission.createdAt
    })

    // Calculate averages, streaks, and badges
    const rankings = []
    let rank = 1

    for (const userId in userStats) {
      const stats = userStats[userId]
      const monthlyAverage = stats.scores.length > 0 
        ? Math.round(stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length)
        : 0
      
      // Calculate improvement (compare with previous month)
      const prevMonth = new Date(startDate)
      prevMonth.setMonth(prevMonth.getMonth() - 1)
      const prevMonthEnd = new Date(startDate.getFullYear(), startDate.getMonth(), 0)
      
      const prevSubmissions = await prisma.submission.findMany({
        where: {
          userId: userId,
          createdAt: {
            gte: prevMonth,
            lte: prevMonthEnd
          }
        },
        include: {
          test: { select: { totalMarks: true } }
        }
      })
      
      const prevAverage = prevSubmissions.length > 0 
        ? Math.round(prevSubmissions.reduce((sum, sub) => {
            const pct = sub.test.totalMarks > 0 ? (sub.score / sub.test.totalMarks) * 100 : 0
            return sum + pct
          }, 0) / prevSubmissions.length)
        : 0
      
      const improvement = monthlyAverage - prevAverage
      
      // Calculate streak (simplified - consecutive days with tests)
      const streak = Math.min(stats.totalTests, 30) // Max 30 day streak
      
      // Assign badge based on performance
      let badge = 'BEGINNER'
      if (monthlyAverage >= 95) badge = 'CHAMPION'
      else if (monthlyAverage >= 85) badge = 'EXCELLENT'
      else if (monthlyAverage >= 70) badge = 'GOOD'
      else if (improvement > 10) badge = 'IMPROVING'
      
      rankings.push({
        id: `monthly_${userId}_${month}`,
        userId: userId,
        user: stats.user,
        rank: 0, // Will be calculated after sorting
        score: stats.totalScore,
        totalTests: stats.totalTests,
        averageScore: monthlyAverage,
        monthlyAverage: monthlyAverage,
        streak: streak,
        badge: badge,
        improvement: improvement
      })
    }

    // Sort by monthly average (descending) and assign ranks
    rankings.sort((a, b) => b.monthlyAverage - a.monthlyAverage)
    rankings.forEach((entry, index) => {
      entry.rank = index + 1
    })

    res.json({
      success: true,
      data: {
        rankings,
        month,
        totalStudents: rankings.length
      }
    })
  } catch (error) {
    console.error('Error fetching monthly leaderboard:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch monthly leaderboard' 
    })
  }
}

// Get test-specific leaderboards
export const getTestLeaderboards = async (req: Request, res: Response) => {
  try {
    const { batch, limit = 5 } = req.query
    
    // Get recent tests
    let whereClause = {}
    if (batch) {
      whereClause.createdBy = {
        batchType: batch
      }
    }
    
    const recentTests = await prisma.test.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      include: {
        submissions: {
          include: {
            user: {
              select: {
                id: true,
                uid: true,
                fullName: true,
                batchType: true
              }
            }
          },
          orderBy: { score: 'desc' }
        }
      }
    })

    const testLeaderboards = recentTests.map(test => {
      const rankings = test.submissions.map((submission, index) => {
        const percentage = test.totalMarks > 0 
          ? Math.round((submission.score / test.totalMarks) * 100)
          : 0
        
        return {
          id: submission.id,
          userId: submission.userId,
          user: submission.user,
          rank: index + 1,
          score: submission.score,
          totalTests: 1, // Individual test
          averageScore: percentage,
          monthlyAverage: percentage,
          streak: 0,
          badge: percentage >= 90 ? 'EXCELLENT' : percentage >= 75 ? 'GOOD' : 'IMPROVING',
          improvement: 0
        }
      })

      return {
        testId: test.id,
        testTitle: test.title,
        rankings: rankings
      }
    })

    res.json({
      success: true,
      data: {
        tests: testLeaderboards
      }
    })
  } catch (error) {
    console.error('Error fetching test leaderboards:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch test leaderboards' 
    })
  }
}

// Get overall platform leaderboard
export const getOverallLeaderboard = async (req: Request, res: Response) => {
  try {
    const { batch } = req.query
    
    let whereClause = {}
    if (batch) {
      whereClause.user = {
        batchType: batch
      }
    }

    // Get all submissions
    const submissions = await prisma.submission.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            uid: true,
            fullName: true,
            batchType: true
          }
        },
        test: {
          select: {
            totalMarks: true
          }
        }
      }
    })

    // Calculate comprehensive user statistics
    const userStats = {}
    
    submissions.forEach(submission => {
      const userId = submission.userId
      const percentage = submission.test.totalMarks > 0 
        ? Math.round((submission.score / submission.test.totalMarks) * 100)
        : 0
      
      if (!userStats[userId]) {
        userStats[userId] = {
          user: submission.user,
          scores: [],
          totalTests: 0,
          totalScore: 0,
          totalPossibleMarks: 0
        }
      }
      
      userStats[userId].scores.push(percentage)
      userStats[userId].totalTests++
      userStats[userId].totalScore += submission.score
      userStats[userId].totalPossibleMarks += submission.test.totalMarks
    })

    // Calculate overall rankings
    const rankings = []
    
    for (const userId in userStats) {
      const stats = userStats[userId]
      
      // Calculate overall average percentage
      const averageScore = stats.scores.length > 0 
        ? Math.round(stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length)
        : 0
      
      // Calculate overall score (weighted by test difficulty/marks)
      const overallScore = stats.totalPossibleMarks > 0 
        ? Math.round((stats.totalScore / stats.totalPossibleMarks) * 1000) // Scale to 1000 for better ranking
        : 0
      
      // Assign comprehensive badge
      let badge = 'BEGINNER'
      if (averageScore >= 95 && stats.totalTests >= 10) badge = 'CHAMPION'
      else if (averageScore >= 85 && stats.totalTests >= 5) badge = 'EXCELLENT'
      else if (averageScore >= 70) badge = 'GOOD'
      else if (stats.totalTests >= 3) badge = 'IMPROVING'
      
      rankings.push({
        id: `overall_${userId}`,
        userId: userId,
        user: stats.user,
        rank: 0, // Will be calculated after sorting
        score: overallScore,
        totalTests: stats.totalTests,
        averageScore: averageScore,
        monthlyAverage: averageScore, // Using overall average for now
        streak: Math.min(stats.totalTests, 50), // Max 50 streak
        badge: badge,
        improvement: 0 // Could be calculated based on recent performance
      })
    }

    // Sort by overall score (descending) and assign ranks
    rankings.sort((a, b) => {
      // Primary sort: overall score
      if (b.score !== a.score) return b.score - a.score
      // Secondary sort: total tests (more tests = higher rank)
      if (b.totalTests !== a.totalTests) return b.totalTests - a.totalTests
      // Tertiary sort: average score
      return b.averageScore - a.averageScore
    })
    
    rankings.forEach((entry, index) => {
      entry.rank = index + 1
    })

    res.json({
      success: true,
      data: {
        rankings,
        totalStudents: rankings.length
      }
    })
  } catch (error) {
    console.error('Error fetching overall leaderboard:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch overall leaderboard' 
    })
  }
}

// Get user's personal leaderboard stats
export const getUserLeaderboardStats = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params
    const { timeframe = 'monthly' } = req.query
    
    // Calculate date range based on timeframe
    let startDate, endDate
    const now = new Date()
    
    switch (timeframe) {
      case 'weekly':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        endDate = now
        break
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = now
        break
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1)
        endDate = now
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        endDate = now
    }
    
    // Get user's submissions in timeframe
    const userSubmissions = await prisma.submission.findMany({
      where: {
        userId: userId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        test: { select: { totalMarks: true } },
        user: { select: { batchType: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // Calculate user stats
    const totalTests = userSubmissions.length
    const totalScore = userSubmissions.reduce((sum, sub) => sum + sub.score, 0)
    const averageScore = totalTests > 0 
      ? Math.round(userSubmissions.reduce((sum, sub) => {
          const pct = sub.test.totalMarks > 0 ? (sub.score / sub.test.totalMarks) * 100 : 0
          return sum + pct
        }, 0) / totalTests)
      : 0
    
    // Get user's rank in their batch
    const batchType = userSubmissions[0]?.user.batchType
    let batchRank = 0
    let totalInBatch = 0
    
    if (batchType) {
      // This is a simplified ranking calculation
      // In production, you'd want to use the same logic as the leaderboard endpoints
      const batchSubmissions = await prisma.submission.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: startDate, lte: endDate },
          user: { batchType: batchType }
        },
        _avg: { score: true },
        _count: { id: true }
      })
      
      totalInBatch = batchSubmissions.length
      const userAvgScore = batchSubmissions.find(s => s.userId === userId)?._avg.score || 0
      batchRank = batchSubmissions.filter(s => (s._avg.score || 0) > userAvgScore).length + 1
    }
    
    // Calculate streak (simplified)
    const streak = Math.min(totalTests, 30)
    
    // Assign badge
    let badge = 'BEGINNER'
    if (averageScore >= 95 && totalTests >= 10) badge = 'CHAMPION'
    else if (averageScore >= 85 && totalTests >= 5) badge = 'EXCELLENT'
    else if (averageScore >= 70) badge = 'GOOD'
    else if (totalTests >= 3) badge = 'IMPROVING'
    
    // Recent performance trend
    const recentSubmissions = userSubmissions.slice(0, 5)
    const recentAverage = recentSubmissions.length > 0
      ? Math.round(recentSubmissions.reduce((sum, sub) => {
          const pct = sub.test.totalMarks > 0 ? (sub.score / sub.test.totalMarks) * 100 : 0
          return sum + pct
        }, 0) / recentSubmissions.length)
      : 0
    
    const improvement = recentAverage - averageScore
    
    res.json({
      success: true,
      data: {
        userId,
        timeframe,
        stats: {
          totalTests,
          totalScore,
          averageScore,
          batchRank,
          totalInBatch,
          streak,
          badge,
          improvement,
          recentAverage
        }
      }
    })
  } catch (error) {
    console.error('Error fetching user leaderboard stats:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user stats' 
    })
  }
}