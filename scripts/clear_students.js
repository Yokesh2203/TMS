import mysql from 'mysql2/promise';

const RAILWAY_URL = 'mysql://root:ShVKUYLNuWhvThDtPuQYaFAwGBGCDJQg@autorack.proxy.rlwy.net:11784/railway';

async function clearStudentsTable() {
  console.log('📡 Connecting to Railway MySQL to clear students table...');
  const connection = await mysql.createConnection({
    uri: RAILWAY_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // TRUNCATE TABLE empties the table and resets AUTO_INCREMENT back to 1
    await connection.query('TRUNCATE TABLE students');
    console.log('✅ `students` table has been truncated!');
    console.log('✅ AUTO_INCREMENT reset to 1. The next student entered will get id = 1, then 2, 3...');

    const [countResult] = await connection.query('SELECT COUNT(*) as total FROM students');
    console.log(`Current student count in DB: ${countResult[0]?.total || 0}`);
  } catch (err) {
    console.error('Error clearing students table:', err.message);
  } finally {
    await connection.end();
  }
}

clearStudentsTable();
