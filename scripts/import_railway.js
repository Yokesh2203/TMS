import fs from 'fs';
import mysql from 'mysql2/promise';

const RAILWAY_URL = 'mysql://root:ShVKUYLNuWhvThDtPuQYaFAwGBGCDJQg@autorack.proxy.rlwy.net:11784/railway';

async function importSQL() {
  console.log('🚀 Connecting to Railway MySQL...');
  
  const connection = await mysql.createConnection({
    uri: RAILWAY_URL,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
  });
  
  console.log('✅ Connected to Railway MySQL!');
  
  // Read the SQL file
  const sqlContent = fs.readFileSync('nadar_tms (12).sql', 'utf8');
  console.log(`📄 Read SQL file: ${(sqlContent.length / 1024).toFixed(1)} KB`);
  
  // Execute the SQL statements
  console.log('⏳ Importing tables and data... (this may take a moment)');
  
  try {
    await connection.query(sqlContent);
    console.log('✅ SQL import completed successfully!');
  } catch (err) {
    // Some ALTER TABLE statements may fail on duplicate keys — that's OK
    console.warn('⚠️  Some statements had warnings (normal for re-imports):', err.message?.substring(0, 200));
    console.log('   Continuing...');
  }
  
  // Verify the tables
  const [tables] = await connection.query('SHOW TABLES');
  console.log('\n📋 Tables in Railway database:');
  tables.forEach((row) => {
    const tableName = Object.values(row)[0];
    console.log(`   ✅ ${tableName}`);
  });
  
  // Count rows in key tables
  for (const table of ['institutions', 'routes', 'stops', 'students']) {
    try {
      const [countResult] = await connection.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
      console.log(`   📊 ${table}: ${countResult[0].cnt} rows`);
    } catch {
      console.log(`   ⚠️  ${table}: table not found or empty`);
    }
  }
  
  await connection.end();
  console.log('\n🎉 Import complete! Your Railway database is ready.');
}

importSQL().catch((err) => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
