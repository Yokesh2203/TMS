import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const RAILWAY_URL = process.env.DATABASE_URL || 
  process.env.MYSQL_URL || 
  'mysql://root:ShVKUYLNuWhvThDtPuQYaFAwGBGCDJQg@autorack.proxy.rlwy.net:11784/railway';

async function exportStudents() {
  console.log('📡 Connecting to Railway MySQL database to export student data...');
  const connection = await mysql.createConnection({
    uri: RAILWAY_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const [rows] = await connection.query(`
      SELECT 
        s.id,
        s.student_name,
        s.identifier,
        s.institution_id,
        s.department_or_class,
        s.year_or_section,
        s.bus_route_id,
        s.bus_route_name,
        s.stopping_name,
        s.created_at
      FROM students s
      ORDER BY s.id ASC
    `);

    console.log(`📊 Found ${rows.length} student record(s) in database.`);

    if (rows.length === 0) {
      console.log('ℹ️ No records found yet to export.');
      return;
    }

    // 1. Generate SQL File (ready for phpMyAdmin / MySQL import)
    const sqlStatements = [
      `-- NSCET Transport Management System - Exported Students Dump`,
      `-- Exported At: ${new Date().toISOString()}`,
      `-- Total Records: ${rows.length}`,
      ``,
      `CREATE TABLE IF NOT EXISTS \`students\` (`,
      `  \`id\` int(11) NOT NULL AUTO_INCREMENT,`,
      `  \`student_name\` varchar(150) NOT NULL,`,
      `  \`identifier\` varchar(50) NOT NULL,`,
      `  \`institution_id\` int(11) NOT NULL,`,
      `  \`department_or_class\` varchar(100) NOT NULL,`,
      `  \`year_or_section\` varchar(50) NOT NULL,`,
      `  \`bus_route_id\` int(11) NOT NULL,`,
      `  \`bus_route_name\` varchar(200) NOT NULL DEFAULT '',`,
      `  \`stopping_name\` varchar(150) NOT NULL,`,
      `  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,`,
      `  PRIMARY KEY (\`id\`)`,
      `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
      ``,
      `INSERT INTO \`students\` (\`id\`, \`student_name\`, \`identifier\`, \`institution_id\`, \`department_or_class\`, \`year_or_section\`, \`bus_route_id\`, \`bus_route_name\`, \`stopping_name\`, \`created_at\`) VALUES`,
    ];

    const valueRows = rows.map((r) => {
      const escape = (str) => (str ? str.replace(/'/g, "\\'") : '');
      const created = r.created_at ? new Date(r.created_at).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');
      return `(${r.id}, '${escape(r.student_name)}', '${escape(r.identifier)}', ${r.institution_id || 1}, '${escape(r.department_or_class)}', '${escape(r.year_or_section)}', ${r.bus_route_id || 0}, '${escape(r.bus_route_name)}', '${escape(r.stopping_name)}', '${created}')`;
    });

    sqlStatements.push(valueRows.join(',\n') + ';');

    const sqlFilePath = path.resolve('exported_students.sql');
    fs.writeFileSync(sqlFilePath, sqlStatements.join('\n'), 'utf-8');
    console.log(`✅ SQL file generated: ${sqlFilePath}`);

    // 2. Generate CSV / Excel File
    const csvHeader = 'S.No,Register Number,Student Name,Department,Year / Section,Bus Route ID,Bus Route Name,Boarding Stop,Registration Date\n';
    const csvRows = rows.map((r) => {
      const safe = (v) => `"${(v || '').toString().replace(/"/g, '""')}"`;
      return [
        r.id,
        safe(r.identifier),
        safe(r.student_name),
        safe(r.department_or_class),
        safe(r.year_or_section),
        r.bus_route_id,
        safe(r.bus_route_name),
        safe(r.stopping_name),
        safe(r.created_at),
      ].join(',');
    });

    const csvFilePath = path.resolve('exported_students.csv');
    fs.writeFileSync(csvFilePath, csvHeader + csvRows.join('\n'), 'utf-8');
    console.log(`✅ CSV / Excel file generated: ${csvFilePath}`);

    // 3. Generate Department-Wise Grouped Report CSV
    const deptMap = new Map();
    rows.forEach((r) => {
      const dept = r.department_or_class || 'Unassigned';
      if (!deptMap.has(dept)) {
        deptMap.set(dept, []);
      }
      deptMap.get(dept).push(r);
    });

    const deptReportLines = [];
    deptReportLines.push('"NADAR SARASWATHI COLLEGE OF ENGINEERING & TECHNOLOGY (NSCET)"');
    deptReportLines.push('"DEPARTMENT-WISE REGISTERED STUDENTS REPORT"');
    deptReportLines.push(`"Generated At: ${new Date().toISOString()}"`);
    deptReportLines.push(`"Total Registered Students: ${rows.length}"`);
    deptReportLines.push('');

    // Summary Header
    deptReportLines.push('"=== DEPARTMENT REGISTRATION SUMMARY ==="');
    deptReportLines.push('"S.No","Department","1st Year","2nd Year","3rd Year","4th Year","Bus Users","Hostellers","Total Registered"');

    let deptSNo = 1;
    console.log('\n📊 Department-Wise Registration Breakdown:');
    console.log('-------------------------------------------------------------------------------------');
    console.log('Dept'.padEnd(40) + '1st'.padStart(6) + '2nd'.padStart(6) + '3rd'.padStart(6) + '4th'.padStart(6) + 'Total'.padStart(8));
    console.log('-------------------------------------------------------------------------------------');

    for (const [dept, deptStudents] of deptMap.entries()) {
      const y1 = deptStudents.filter((s) => s.year_or_section === '1st Year').length;
      const y2 = deptStudents.filter((s) => s.year_or_section === '2nd Year').length;
      const y3 = deptStudents.filter((s) => s.year_or_section === '3rd Year').length;
      const y4 = deptStudents.filter((s) => s.year_or_section === '4th Year').length;
      const bus = deptStudents.filter((s) => s.bus_route_id && (s.bus_route_name || s.stopping_name)).length;
      const hostel = deptStudents.length - bus;

      deptReportLines.push(
        `"${deptSNo++}","${dept}","${y1}","${y2}","${y3}","${y4}","${bus}","${hostel}","${deptStudents.length}"`
      );

      console.log(
        dept.padEnd(40) +
          String(y1).padStart(6) +
          String(y2).padStart(6) +
          String(y3).padStart(6) +
          String(y4).padStart(6) +
          String(deptStudents.length).padStart(8)
      );
    }
    console.log('-------------------------------------------------------------------------------------');
    console.log('TOTAL REGISTERED STUDENTS:'.padEnd(64) + String(rows.length).padStart(8));
    console.log('-------------------------------------------------------------------------------------\n');

    deptReportLines.push('');
    deptReportLines.push('"=== DETAILED STUDENT ROSTERS (GROUPED BY DEPARTMENT) ==="');
    deptReportLines.push('"Department","S.No","Register Number","Student Name","Year / Section","Bus Route","Boarding Stop","Registered Date"');

    for (const [dept, deptStudents] of deptMap.entries()) {
      deptStudents.forEach((s, idx) => {
        const safe = (v) => `"${(v || '').toString().replace(/"/g, '""')}"`;
        deptReportLines.push(
          [
            safe(dept),
            idx + 1,
            safe(s.identifier),
            safe(s.student_name),
            safe(s.year_or_section),
            safe(s.bus_route_name || 'Hostel'),
            safe(s.stopping_name || 'Hostel'),
            safe(s.created_at),
          ].join(',')
        );
      });
    }

    const deptReportPath = path.resolve('department_wise_report.csv');
    fs.writeFileSync(deptReportPath, '\uFEFF' + deptReportLines.join('\n'), 'utf-8');
    console.log(`✅ Department-Wise Report generated: ${deptReportPath}`);

    console.log('\n🎉 Export complete! You can open department_wise_report.csv or exported_students.csv in Excel.');
  } catch (err) {
    console.error('❌ Export failed:', err);
  } finally {
    await connection.end();
  }
}

exportStudents();
