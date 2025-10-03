// Create Demo Data for Attendance Testing
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function createDemoAttendanceData() {
  console.log('🚀 Creating demo attendance data...')

  try {
    // Get existing users
    const headTeacher = await prisma.user.findFirst({ 
      where: { role: 'HEAD_TEACHER' } 
    })
    const teacher = await prisma.user.findFirst({ 
      where: { role: 'TEACHER' } 
    })
    const student = await prisma.user.findFirst({ 
      where: { role: 'STUDENT' } 
    })

    if (!headTeacher || !teacher || !student) {
      console.error('❌ Required users not found. Please run seed script first.')
      return
    }

    console.log('👥 Found users:', { headTeacher: headTeacher.uid, teacher: teacher.uid, student: student.uid })

    // Create some demo class schedules for today and tomorrow
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const schedulesToCreate = [
      {
        subject: 'Mathematics',
        teacherId: teacher.id,
        creatorId: headTeacher.id,
        batchType: 'PCM_11',
        roomNumber: 'Room 101',
        date: today,
        startTime: '09:00',
        endTime: '10:30',
        topic: 'Calculus - Limits and Derivatives',
        description: 'Introduction to differential calculus',
      },
      {
        subject: 'Physics',
        teacherId: teacher.id,
        creatorId: headTeacher.id,
        batchType: 'PCM_11',
        roomNumber: 'Room 102',
        date: today,
        startTime: '11:00',
        endTime: '12:30',
        topic: 'Mechanics - Laws of Motion',
        description: 'Newton\'s laws and applications',
      },
      {
        subject: 'Chemistry',
        teacherId: teacher.id,
        creatorId: headTeacher.id,
        batchType: 'PCM_12',
        roomNumber: 'Room 103',
        date: tomorrow,
        startTime: '14:00',
        endTime: '15:30',
        topic: 'Organic Chemistry - Hydrocarbons',
        description: 'Alkanes, alkenes, and alkynes',
      },
      {
        subject: 'Mathematics',
        teacherId: teacher.id,
        creatorId: headTeacher.id,
        batchType: 'NEET_11',
        roomNumber: 'Room 104',
        date: tomorrow,
        startTime: '16:00',
        endTime: '17:30',
        topic: 'Statistics and Probability',
        description: 'Probability distributions and statistics',
      }
    ]

    console.log('📅 Creating class schedules...')
    const createdSchedules = []

    for (const schedule of schedulesToCreate) {
      const created = await prisma.classSchedule.create({
        data: schedule
      })
      createdSchedules.push(created)
      console.log(`   ✅ Created: ${schedule.subject} - ${schedule.batchType} on ${schedule.date.toDateString()}`)
    }

    // Create additional demo students for better testing
    console.log('👨‍🎓 Creating additional demo students...')
    const additionalStudents = [
      {
        uid: 'STU001',
        password: '$2b$10$abcdefghijklmnopqrstuvwxyz', // dummy hash
        fullName: 'Alice Johnson',
        role: 'STUDENT',
        batchType: 'PCM_11'
      },
      {
        uid: 'STU002', 
        password: '$2b$10$abcdefghijklmnopqrstuvwxyz',
        fullName: 'Bob Smith',
        role: 'STUDENT',
        batchType: 'PCM_11'
      },
      {
        uid: 'STU003',
        password: '$2b$10$abcdefghijklmnopqrstuvwxyz',
        fullName: 'Carol Davis',
        role: 'STUDENT',
        batchType: 'PCM_12'
      },
      {
        uid: 'STU004',
        password: '$2b$10$abcdefghijklmnopqrstuvwxyz',
        fullName: 'David Wilson',
        role: 'STUDENT', 
        batchType: 'NEET_11'
      }
    ]

    for (const studentData of additionalStudents) {
      const existing = await prisma.user.findUnique({ where: { uid: studentData.uid } })
      if (!existing) {
        await prisma.user.create({ data: studentData })
        console.log(`   ✅ Created student: ${studentData.fullName} (${studentData.uid})`)
      } else {
        console.log(`   ⚠️  Student already exists: ${studentData.uid}`)
      }
    }

    // Create some demo notifications
    console.log('🔔 Creating demo notifications...')
    const notifications = [
      {
        title: 'Class Schedule Updated',
        message: 'Mathematics class has been moved to Room 101',
        type: 'INFO',
        userId: student.id,
        isRead: false
      },
      {
        title: 'Attendance Reminder', 
        message: 'Please ensure you attend today\'s Physics lecture',
        type: 'WARNING',
        userId: student.id,
        isRead: false
      }
    ]

    for (const notif of notifications) {
      await prisma.notification.create({ data: notif })
      console.log(`   ✅ Created notification: ${notif.title}`)
    }

    console.log('\\n🎉 Demo attendance data created successfully!')
    console.log('\\n📋 Summary:')
    console.log(`   • ${createdSchedules.length} class schedules created`)
    console.log(`   • Additional demo students created`)  
    console.log(`   • Demo notifications created`)
    console.log('\\n🔗 You can now:')
    console.log('   • Login as TRE000 (Teacher) to mark attendance')
    console.log('   • Login as HTR000 (Head Teacher) to view reports') 
    console.log('   • Login as STH000 (Student) to view attendance')

  } catch (error) {
    console.error('❌ Error creating demo data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createDemoAttendanceData()