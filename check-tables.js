
// Ported from check-tables.php
// Lists tables in the database containing 'social' or 'property'.
import mysql from 'mysql2/promise';

async function main() {
	const connection = await mysql.createConnection({
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT || 3306,
		user: process.env.DB_USERNAME || 'root',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_DATABASE || 'job_portal',
	});

	const dbName = process.env.DB_DATABASE || 'job_portal';
	const [tables] = await connection.execute(
		'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
		[dbName]
	);
	console.log(`Tables in database: ${dbName}`);
	console.log('===========================');
	tables.forEach(row => {
		const tableName = row.TABLE_NAME;
		if (tableName.includes('social') || tableName.includes('property')) {
			console.log(`✓ ${tableName}`);
		}
	});

	await connection.end();
}

main().catch(err => { console.error(err); process.exit(1); });
