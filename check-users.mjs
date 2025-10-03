import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  console.log('🔍 Checking existing users in database...');
  
  try {
    const users = await prisma.user.findMany({
      select: {
        uid: true,
        fullName: true,
        role: true,
        batchType: true
      },
      orderBy: [
        { role: 'asc' },
        { uid: 'asc' }
      ]
    });
    
    console.log(`Found ${users.length} users:`);
    
    users.forEach(user => {
      console.log(`${user.uid.padEnd(10)} | ${user.fullName.padEnd(25)} | ${user.role.padEnd(15)} | ${user.batchType || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Error checking users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();