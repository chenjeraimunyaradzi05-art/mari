
// Ported from check-db.php
// Checks for tables containing 'job' and prints structure of 'jobs' table.
import mysql from 'mysql2/promise';

async function main() {
	const connection = await mysql.createConnection({
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT || 3306,
		user: process.env.DB_USERNAME || 'root',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_DATABASE || 'job_portal',
	});

	console.log('Checking database tables...');
	const [tables] = await connection.execute('SHOW TABLES');
	tables.forEach(row => {
		const tableName = Object.values(row)[0];
		if (tableName.includes('job')) {
			console.log(`Found: ${tableName}`);
		}
	});

	console.log('\nChecking jobs table structure...');
	const [columns] = await connection.execute('DESC jobs');
	columns.forEach(col => {
		console.log(`  - ${col.Field} (${col.Type})`);
	});

	await connection.end();
}

main().catch(err => { console.error(err); process.exit(1); });
