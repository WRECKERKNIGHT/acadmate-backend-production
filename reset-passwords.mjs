import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function resetDemoPasswords() {
  console.log('🔄 Resetting demo user passwords...');
  
  try {
    const demoPassword = 'demo123';
    const hashedPassword = await bcrypt.hash(demoPassword, 10);
    
    // Update demo users with known password
    const result = await prisma.user.updateMany({
      where: {
        uid: {
          in: ['STH000', 'TRE000', 'HTR000']
        }
      },
      data: {
        password: hashedPassword
      }
    });
    
    console.log(`✅ Updated ${result.count} demo user passwords!`);
    console.log('\n📋 Demo Login Credentials:');
    console.log('• Student: STH000 / demo123');
    console.log('• Teacher: TRE000 / demo123');
    console.log('• Head Teacher: HTR000 / demo123');
    
  } catch (error) {
    console.error('❌ Error updating passwords:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetDemoPasswords();