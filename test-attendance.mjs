import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000';

// Test attendance API endpoints
async function testAttendanceAPIs() {
  console.log('🧪 Testing Attendance API endpoints...');
  
  try {
    // First login as teacher to get token
    console.log('\n1. Logging in as teacher...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: 'TRE000', password: 'demo123' })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginResponse.status, loginData);
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginData.error || loginData.message || JSON.stringify(loginData)}`);
    }
    
    const token = loginData.token;
    console.log('   ✅ Login successful!');
    
    // Get teacher's classes
    console.log('\n2. Getting teacher\'s scheduled classes...');
    const classesResponse = await fetch(`${API_BASE}/api/scheduling/my-classes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const classesData = await classesResponse.json();
    console.log('Classes response:', classesData);
    if (!classesResponse.ok) {
      throw new Error(`Failed to get classes: ${classesData.message}`);
    }
    
    // Handle array response or data property
    const classes = Array.isArray(classesData) ? classesData : (classesData.classes || classesData.data || []);
    
    console.log(`   ✅ Found ${classes.length} scheduled classes`);
    classes.forEach(cls => {
      console.log(`      - ${cls.subject} (${cls.batchType}) at ${cls.startTime}-${cls.endTime}`);
    });
    
    if (classes.length === 0) {
      console.log('   ⚠️  No classes found for today. Check if demo data was created properly.');
      return;
    }
    
    // Get students for the first class
    const firstClass = classes[0];
    console.log(`\n3. Getting students for ${firstClass.subject} class...`);
    const studentsResponse = await fetch(`${API_BASE}/api/attendance/students/${firstClass.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const studentsData = await studentsResponse.json();
    console.log('Students response:', studentsData);
    if (!studentsResponse.ok) {
      throw new Error(`Failed to get students: ${studentsData.message}`);
    }
    
    // Handle array response or data property
    const students = Array.isArray(studentsData) ? studentsData : (studentsData.students || studentsData.data || []);
    
    console.log(`   ✅ Found ${students.length} students for this class`);
    students.forEach(student => {
      console.log(`      - ${student.fullName} (${student.uid})`);
    });
    
    if (students.length === 0) {
      console.log('   ⚠️  No students found. This is expected as students might be in different batches.');
    }
    
    // Test marking attendance (only if there are students)
    if (students.length > 0) {
      console.log('\n4. Testing attendance marking...');
      
      const attendanceData = students.map(student => ({
        studentId: student.id,
        status: 'PRESENT',
        notes: 'Test attendance marking'
      }));
      
      const markResponse = await fetch(`${API_BASE}/api/attendance/mark`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          classScheduleId: firstClass.id,
          attendanceData
        })
      });
      
      const markData = await markResponse.json();
      if (!markResponse.ok) {
        throw new Error(`Failed to mark attendance: ${markData.message || JSON.stringify(markData)}`);
      }
      
      console.log('   ✅ Attendance marked successfully!');
      console.log(`   ✅ Marked attendance for ${markData.attendance?.length || 0} students`);
    }
    
    console.log('\n🎉 All attendance API tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAttendanceAPIs();