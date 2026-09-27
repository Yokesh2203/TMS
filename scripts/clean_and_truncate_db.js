import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const rawDatabaseUrl = 
  process.env.DATABASE_URL || 
  process.env.MYSQL_URL || 
  process.env.MYSQL_PRIVATE_URL || 
  process.env.MYSQL_PUBLIC_URL;

async function runCleanup() {
  console.log('Connecting to database...');
  let conn;
  if (rawDatabaseUrl) {
    conn = await mysql.createConnection({
      uri: rawDatabaseUrl,
      ssl: { rejectUnauthorized: false },
    });
  } else {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'railway',
    });
  }

  console.log('✅ Connected to database.');

  // 1. Check columns in students table
  const [columns] = await conn.query('SHOW COLUMNS FROM students');
  console.log('Current columns in students table:', columns.map(c => c.Field));

  const hasSNo = columns.some(c => c.Field === 's_no');
  if (hasSNo) {
    console.log('🗑️ Dropping `s_no` column from `students` table...');
    await conn.query('ALTER TABLE students DROP COLUMN s_no');
    console.log('✅ Successfully dropped `s_no` column.');
  } else {
    console.log('ℹ️ No `s_no` column found to drop.');
  }

  // 2. Truncate students table
  console.log('🧹 Clearing all student data and resetting AUTO_INCREMENT to 1...');
  await conn.query('TRUNCATE TABLE students');
  console.log('✅ Students table truncated. First new student will start at id = 1.');

  // 3. Verify table structure and count
  const [updatedCols] = await conn.query('SHOW COLUMNS FROM students');
  console.log('Updated columns in students table:', updatedCols.map(c => c.Field));

  const [countResult] = await conn.query('SELECT COUNT(*) as total FROM students');
  console.log('Current student count:', countResult[0].total);

  await conn.end();
  console.log('🎉 Cleanup and migration complete!');
}

runCleanup().catch((err) => {
  console.error('❌ Error during cleanup:', err);
  process.exit(1);
});
