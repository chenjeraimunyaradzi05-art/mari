
// Ported from check-categories.php
// This script checks, lists, and deletes all categories in the women_listing_categories table.
// Requires a configured database connection and a WomenListingCategory model.

import mysql from 'mysql2/promise';

async function main() {
	const connection = await mysql.createConnection({
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT || 3306,
		user: process.env.DB_USERNAME || 'root',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_DATABASE || 'job_portal',
	});

	console.log('Checking categories...');
	const [rows] = await connection.execute('SELECT COUNT(*) as count FROM women_listing_categories');
	const count = rows[0].count;
	console.log(`Total categories: ${count}`);

	if (count > 0) {
		console.log('\nExisting categories:');
		const [cats] = await connection.execute('SELECT slug, name FROM women_listing_categories');
		cats.forEach(cat => {
			console.log(`  - ${cat.slug}: ${cat.name}`);
		});

		console.log('\nDeleting all categories...');
		await connection.execute('TRUNCATE TABLE women_listing_categories');
		console.log('Deleted!');
	}

	await connection.end();
}

main().catch(err => { console.error(err); process.exit(1); });
