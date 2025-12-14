
// Ported from clear-women-tables.php
// Truncates a list of women_* tables, disabling foreign key checks.
import mysql from 'mysql2/promise';

async function main() {
	const connection = await mysql.createConnection({
		host: process.env.DB_HOST || '127.0.0.1',
		port: process.env.DB_PORT || 3306,
		user: process.env.DB_USERNAME || 'root',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_DATABASE || 'job_portal',
	});

	// Disable foreign key checks
	await connection.execute('SET FOREIGN_KEY_CHECKS=0');

	const tables = [
		'women_dashboard_widgets',
		'women_inference_logs',
		'women_agent_verification_audits',
		'women_dashboard_preferences',
		'women_goal_trackers',
		'women_partner_matches',
		'women_partner_projects',
		'women_cohort_enrolments',
		'women_cohort_profiles',
		'women_agent_leads',
		'women_listing_partner_intentions',
		'women_listing_social_shares',
		'women_listings',
		'women_verified_agents',
		'women_listing_locations',
		'women_listing_categories',
	];

	for (const table of tables) {
		try {
			await connection.execute(`TRUNCATE TABLE \`${table}\``);
			console.log(`✓ Truncated: ${table}`);
		} catch (e) {
			console.log(`Skipped: ${table} (not found)`);
		}
	}

	// Re-enable foreign key checks
	await connection.execute('SET FOREIGN_KEY_CHECKS=1');
	console.log('\nDone! Tables cleared.');

	await connection.end();
}

main().catch(err => { console.error(err); process.exit(1); });
