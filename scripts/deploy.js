#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function deploymentSetup() {
  console.log('🚀 Starting deployment setup...');
  
  try {
    // Run Prisma migrations
    console.log('📊 Setting up database...');
    
    // Check if users already exist
    const existingUsers = await prisma.user.count();
    
    if (existingUsers === 0) {
      console.log('👤 Creating demo users...');
      
      const demoPassword = 'demo123';
      const hashedPassword = await bcrypt.hash(demoPassword, 10);
      
      const demoUsers = [
        {
          uid: 'STH000',
          password: hashedPassword,
          fullName: 'Demo Student',
          role: 'STUDENT',
          batchType: 'NEET_12',
          isActive: true
        },
        {
          uid: 'TRE000',
          password: hashedPassword,
          fullName: 'Demo Teacher', 
          role: 'TEACHER',
          subjects: JSON.stringify(['Physics', 'Chemistry', 'Mathematics']),
          isActive: true
        },
        {
          uid: 'HTR000',
          password: hashedPassword,
          fullName: 'Demo Head Teacher',
          role: 'HEAD_TEACHER',
          subjects: JSON.stringify(['Administration']),
          isActive: true
        }
      ];
      
      await prisma.user.createMany({
        data: demoUsers
      });
      
      console.log('✅ Demo users created');
      
      // Create some demo students for attendance
      const additionalStudents = [
        {
          uid: 'STU001',
          password: hashedPassword,
          fullName: 'Alice Johnson',
          role: 'STUDENT',
          batchType: 'PCM_11',
          isActive: true
        },
        {
          uid: 'STU002',
          password: hashedPassword,
          fullName: 'Bob Smith',
          role: 'STUDENT',
          batchType: 'PCM_11',
          isActive: true
        }
      ];
      
      await prisma.user.createMany({
        data: additionalStudents
      });
      
      console.log('✅ Additional demo students created');
      
      // Create demo class schedules
      const teacher = await prisma.user.findUnique({ where: { uid: 'TRE000' } });
      const headTeacher = await prisma.user.findUnique({ where: { uid: 'HTR000' } });
      
      if (teacher && headTeacher) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const demoClasses = [
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
            description: 'Newton\\'s laws and applications',
          }
        ];
        
        await prisma.classSchedule.createMany({
          data: demoClasses
        });
        
        console.log('✅ Demo class schedules created');
      }
      
    } else {
      console.log('👤 Users already exist, skipping demo data creation');
    }
    
    console.log('🎉 Deployment setup completed successfully!');
    console.log('\\n📋 Demo Login Credentials:');
    console.log('• Student: STH000 / demo123');
    console.log('• Teacher: TRE000 / demo123');
    console.log('• Head Teacher: HTR000 / demo123');
    
  } catch (error) {
    console.error('❌ Deployment setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deploymentSetup();