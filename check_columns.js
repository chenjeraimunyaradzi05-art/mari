
// Ported from check_columns.php
// Lists columns of the 'identity_flags' table.
import mysql from 'mysql2/promise';

async function main() {
	const connection = await mysql.createConnection({
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT || 3306,
		user: process.env.DB_USERNAME || 'root',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_DATABASE || 'job_portal',
	});

	const [columns] = await connection.execute('SHOW COLUMNS FROM identity_flags');
	console.log(columns.map(col => col.Field).join(', '));

	await connection.end();
}

main().catch(err => { console.error(err); process.exit(1); });
