import { PrismaClient, BatchType, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
// Sample student names for realistic data
const studentNames = [
    'Aarav Sharma', 'Vivaan Patel', 'Aditya Kumar', 'Vihaan Singh', 'Arjun Gupta',
    'Sai Reddy', 'Reyansh Agarwal', 'Ayaan Khan', 'Krishna Joshi', 'Ishaan Nair',
    'Dhruv Malhotra', 'Atharv Rao', 'Ryan Mehta', 'Arnav Bansal', 'Veer Chopra',
    'Rudra Saxena', 'Yash Verma', 'Ved Tiwari', 'Aryan Mishra', 'Kabir Srivastava',
    'Ananya Sharma', 'Diya Patel', 'Prisha Kumar', 'Anika Singh', 'Navya Gupta',
    'Kiara Reddy', 'Myra Agarwal', 'Aditi Khan', 'Kavya Joshi', 'Avni Nair',
    'Sara Malhotra', 'Tara Rao', 'Riya Mehta', 'Aadhya Bansal', 'Pari Chopra',
    'Zara Saxena', 'Ira Verma', 'Mira Tiwari', 'Aria Mishra', 'Nora Srivastava',
    'Arya Bhatt', 'Isha Bose', 'Rhea Iyer', 'Ahana Das', 'Saanvi Roy',
    'Mahi Ghosh', 'Reet Dutta', 'Vanya Sen', 'Pihu Paul', 'Drishti Kar',
    'Reeva Modi', 'Shanaya Goel', 'Mysha Yadav', 'Kashvi Pandey', 'Aarya Tripathi',
    'Divyanshi Shah', 'Charvi Jain', 'Manvi Arora', 'Riddhi Gupta', 'Khushi Singh',
    'Advait Sharma', 'Shivansh Patel', 'Kairav Kumar', 'Aadhav Singh', 'Viaan Gupta',
    'Ayush Reddy', 'Darsh Agarwal', 'Gauriv Khan', 'Hitesh Joshi', 'Ivan Nair',
    'Jaiveer Malhotra', 'Karan Rao', 'Laksh Mehta', 'Manav Bansal', 'Neil Chopra',
    'Om Saxena', 'Parth Verma', 'Quin Tiwari', 'Rohan Mishra', 'Surya Srivastava'
];
const teacherNames = [
    'Dr. Rajesh Kumar', 'Prof. Sunita Sharma', 'Dr. Amit Patel', 'Mrs. Priya Singh',
    'Mr. Vikash Gupta', 'Dr. Meera Reddy', 'Prof. Ravi Agarwal', 'Mrs. Kavita Khan',
    'Dr. Suresh Joshi', 'Prof. Neha Nair', 'Mr. Deepak Malhotra', 'Dr. Pooja Rao',
    'Prof. Manoj Mehta', 'Mrs. Seema Bansal', 'Dr. Arun Chopra', 'Prof. Rekha Saxena',
    'Mr. Sanjay Verma', 'Dr. Anita Tiwari', 'Prof. Rohit Mishra', 'Mrs. Shweta Srivastava'
];
const subjects = {
    inClass: ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies'],
    neet: ['Physics', 'Chemistry', 'Biology'],
    pcm: ['Physics', 'Chemistry', 'Mathematics']
};
// Generate UID function
function generateUID(name, batchCode, isTeacher = false) {
    const prefix = isTeacher ? 'T' : 'S';
    const nameCode = name.split(' ')[0].substring(0, 2).toUpperCase();
    return `${prefix}${nameCode}${batchCode}`;
}
// Generate random date of birth
function generateDOB(minAge, maxAge) {
    const today = new Date();
    const minYear = today.getFullYear() - maxAge;
    const maxYear = today.getFullYear() - minAge;
    const year = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
    const month = Math.floor(Math.random() * 12);
    const day = Math.floor(Math.random() * 28) + 1;
    return new Date(year, month, day);
}
// Generate password (first two letters + batch code)
function generatePassword(name, batchCode) {
    const firstTwo = name.split(' ')[0].substring(0, 2).toLowerCase();
    return firstTwo + batchCode;
}
export async function seedAcadmateData() {
    console.log('🌱 Seeding Acadmate data...');
    try {
        // Clear existing data
        await prisma.user.deleteMany({});
        console.log('Cleared existing users');
        const users = [];
        // Generate students for each batch (10 students per batch)
        const batches = [
            { type: BatchType.IN_CLASS_7, code: 'IC7', ageRange: [12, 13] },
            { type: BatchType.IN_CLASS_8, code: 'IC8', ageRange: [13, 14] },
            { type: BatchType.IN_CLASS_9, code: 'IC9', ageRange: [14, 15] },
            { type: BatchType.IN_CLASS_10, code: 'IC10', ageRange: [15, 16] },
            { type: BatchType.NEET_11, code: 'N11', ageRange: [16, 17] },
            { type: BatchType.NEET_12, code: 'N12', ageRange: [17, 18] },
            { type: BatchType.PCM_11, code: 'P11', ageRange: [16, 17] },
            { type: BatchType.PCM_12, code: 'P12', ageRange: [17, 18] }
        ];
        let studentIndex = 0;
        for (const batch of batches) {
            console.log(`Creating students for ${batch.type}...`);
            for (let i = 0; i < 10; i++) {
                const name = studentNames[studentIndex % studentNames.length];
                const uid = generateUID(name, batch.code);
                const password = generatePassword(name, batch.code);
                const hashedPassword = await bcrypt.hash(password, 12);
                users.push({
                    uid,
                    password: hashedPassword,
                    fullName: name,
                    role: Role.STUDENT,
                    batchType: batch.type,
                    dateOfBirth: generateDOB(batch.ageRange[0], batch.ageRange[1]),
                    isActive: true
                });
                console.log(`  Student: ${name} | UID: ${uid} | Password: ${password}`);
                studentIndex++;
            }
        }
        // Generate 20 teachers with subject assignments
        console.log('Creating teachers...');
        for (let i = 0; i < 20; i++) {
            const name = teacherNames[i];
            const uid = generateUID(name, 'TCH', true);
            const password = generatePassword(name, 'TCH');
            const hashedPassword = await bcrypt.hash(password, 12);
            // Assign subjects based on teacher role
            let teacherSubjects = [];
            let teacherBatches = [];
            if (i < 5) {
                // In-class teachers
                teacherSubjects = subjects.inClass.slice(0, 2 + Math.floor(Math.random() * 2));
                teacherBatches = [BatchType.IN_CLASS_7, BatchType.IN_CLASS_8, BatchType.IN_CLASS_9, BatchType.IN_CLASS_10];
            }
            else if (i < 12) {
                // NEET teachers
                teacherSubjects = subjects.neet.slice(0, 1 + Math.floor(Math.random() * 2));
                teacherBatches = [BatchType.NEET_11, BatchType.NEET_12];
            }
            else if (i < 19) {
                // PCM teachers
                teacherSubjects = subjects.pcm.slice(0, 1 + Math.floor(Math.random() * 2));
                teacherBatches = [BatchType.PCM_11, BatchType.PCM_12];
            }
            else {
                // Head teacher
                users.push({
                    uid,
                    password: hashedPassword,
                    fullName: name,
                    role: Role.HEAD_TEACHER,
                    subjects: JSON.stringify(['Administration']),
                    roomNumber: 'ADMIN',
                    dateOfBirth: generateDOB(30, 50),
                    isActive: true
                });
                console.log(`  Head Teacher: ${name} | UID: ${uid} | Password: ${password} | Role: HEAD_TEACHER`);
                continue;
            }
            users.push({
                uid,
                password: hashedPassword,
                fullName: name,
                role: Role.TEACHER,
                subjects: JSON.stringify(teacherSubjects),
                roomNumber: `R${100 + i}`,
                dateOfBirth: generateDOB(25, 45),
                isActive: true
            });
            console.log(`  Teacher: ${name} | UID: ${uid} | Password: ${password} | Subjects: ${teacherSubjects.join(', ')}`);
        }
        // Create all users
        await prisma.user.createMany({
            data: users
        });
        console.log(`✅ Successfully created ${users.length} users (${batches.length * 10} students + 20 teachers)`);
        console.log('\n📋 ACADMATE LOGIN CREDENTIALS:');
        console.log('=================================');
        // Display login credentials
        const allUsers = await prisma.user.findMany({
            orderBy: [
                { role: 'asc' },
                { batchType: 'asc' },
                { fullName: 'asc' }
            ]
        });
        console.log('\n👨‍🎓 STUDENTS:');
        allUsers.filter(u => u.role === 'STUDENT').forEach(user => {
            const password = generatePassword(user.fullName, user.batchType?.replace('_', '').replace('IN_CLASS_', 'IC') || '');
            console.log(`${user.fullName.padEnd(20)} | UID: ${user.uid.padEnd(8)} | Password: ${password.padEnd(8)} | Batch: ${user.batchType}`);
        });
        console.log('\n👨‍🏫 TEACHERS:');
        allUsers.filter(u => u.role === 'TEACHER').forEach(user => {
            const password = generatePassword(user.fullName, 'TCH');
            const subjectsArray = user.subjects ? JSON.parse(user.subjects) : [];
            console.log(`${user.fullName.padEnd(25)} | UID: ${user.uid.padEnd(8)} | Password: ${password.padEnd(8)} | Subjects: ${subjectsArray.join(', ')}`);
        });
        console.log('\n👑 HEAD TEACHER:');
        allUsers.filter(u => u.role === 'HEAD_TEACHER').forEach(user => {
            const password = generatePassword(user.fullName, 'TCH');
            console.log(`${user.fullName.padEnd(25)} | UID: ${user.uid.padEnd(8)} | Password: ${password.padEnd(8)} | Role: HEAD_TEACHER`);
        });
    }
    catch (error) {
        console.error('Error seeding data:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedAcadmateData()
        .then(() => {
        console.log('✅ Data seeding completed!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('❌ Data seeding failed:', error);
        process.exit(1);
    });
}
