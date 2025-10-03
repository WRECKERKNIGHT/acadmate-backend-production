import { PrismaClient, BatchType, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
export async function seedCustomUsers() {
    console.log('🌱 Seeding custom demo users...');
    try {
        // Clear existing users first
        await prisma.user.deleteMany({});
        console.log('Cleared existing users');
        const password = 'password@123';
        const hashedPassword = await bcrypt.hash(password, 12);
        // Create the three specific users you requested
        const customUsers = [
            {
                uid: 'sth000',
                password: hashedPassword,
                fullName: 'Demo Student',
                role: Role.STUDENT,
                batchType: BatchType.NEET_12,
                dateOfBirth: new Date('2006-05-15'),
                isActive: true,
                phone: '+91-9876543210',
                address: 'Student Address, City'
            },
            {
                uid: 'tre000',
                password: hashedPassword,
                fullName: 'Demo Teacher',
                role: Role.TEACHER,
                subjects: JSON.stringify(['Physics', 'Chemistry', 'Mathematics']),
                roomNumber: 'R101',
                dateOfBirth: new Date('1985-08-20'),
                isActive: true,
                phone: '+91-9876543211',
                address: 'Teacher Address, City'
            },
            {
                uid: 'htr000',
                password: hashedPassword,
                fullName: 'Demo Head Teacher',
                role: Role.HEAD_TEACHER,
                subjects: JSON.stringify(['Administration', 'All Subjects']),
                roomNumber: 'ADMIN',
                dateOfBirth: new Date('1975-12-10'),
                isActive: true,
                phone: '+91-9876543212',
                address: 'Head Teacher Address, City'
            }
        ];
        // Create users
        await prisma.user.createMany({
            data: customUsers
        });
        console.log('✅ Successfully created demo users!');
        console.log('\n📋 DEMO LOGIN CREDENTIALS:');
        console.log('=================================');
        console.log('👨‍🎓 STUDENT:');
        console.log('  Name: Demo Student');
        console.log('  UID: sth000');
        console.log('  Password: password@123');
        console.log('  Role: STUDENT');
        console.log('  Batch: NEET 12th');
        console.log('');
        console.log('👨‍🏫 TEACHER:');
        console.log('  Name: Demo Teacher');
        console.log('  UID: tre000');
        console.log('  Password: password@123');
        console.log('  Role: TEACHER');
        console.log('  Subjects: Physics, Chemistry, Mathematics');
        console.log('');
        console.log('👑 HEAD TEACHER:');
        console.log('  Name: Demo Head Teacher');
        console.log('  UID: htr000');
        console.log('  Password: password@123');
        console.log('  Role: HEAD_TEACHER');
        console.log('  Access: All administrative functions');
        console.log('\n🌐 Access the website at: http://localhost:5173/');
    }
    catch (error) {
        console.error('Error seeding custom users:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
// Run the seeding function
seedCustomUsers()
    .then(() => {
    console.log('✅ Custom user seeding completed!');
    process.exit(0);
})
    .catch((error) => {
    console.error('❌ Custom user seeding failed:', error);
    process.exit(1);
});
