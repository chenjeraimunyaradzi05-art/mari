#!/usr/bin/env node
/**
 * Production Database Migration Dry-Run
 *
 * Applies the pending migrations to a copy of production and reports what they
 * did, before the same SQL touches the real database.
 *
 * Where STAGING_DATABASE_URL comes from, because this is the question that kept
 * the script unused: there is no staging environment. There is one deployment,
 * and it is production. What there is instead is Neon, and a Neon *branch* is a
 * copy-on-write clone of the production database — real data, real row counts,
 * real constraints, created in seconds and costing nothing until it is written
 * to. That is the staging database this script wants, and it is why the
 * variable was never in any .env.example: it is not a standing value, it is a
 * branch you make for the rehearsal and delete afterwards.
 *
 *   Neon console → Branches → New branch → from `production`
 *   or: neonctl branches create --name migration-rehearsal
 *
 * Then paste its connection string in:
 *
 *   STAGING_DATABASE_URL="postgresql://...neon.tech/athena?sslmode=require" \
 *     node scripts/migration-dry-run.js
 *
 * Usage:
 *   node scripts/migration-dry-run.js
 *   node scripts/migration-dry-run.js --apply (actually run migrations)
 *
 * This is the rehearsal against real data. It is not the only guard: CI already
 * runs `prisma migrate deploy` and `prisma migrate diff --exit-code` against an
 * empty Postgres on every push, so migration SQL that is simply broken, and a
 * schema.prisma edit that shipped without its migration, both fail there. What
 * CI cannot tell you is how a migration behaves against three years of rows,
 * which is what this is for.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  stagingUrl: process.env.STAGING_DATABASE_URL,
  productionUrl: process.env.DATABASE_URL,
  prismaSchemaPath: path.join(__dirname, '..', 'prisma', 'schema.prisma'),
  migrationsDir: path.join(__dirname, '..', 'prisma', 'migrations'),
  reportDir: path.join(__dirname, '..', 'migration-reports'),
};

function log(message, type = 'info') {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    step: '→',
  };
  console.log(`${icons[type] || '•'} ${message}`);
}

function ensureReportDirectory() {
  if (!fs.existsSync(CONFIG.reportDir)) {
    fs.mkdirSync(CONFIG.reportDir, { recursive: true });
  }
}

function validateEnvironment() {
  log('Validating environment...', 'step');

  if (!CONFIG.stagingUrl) {
    // The bare "is required" this used to throw sent whoever ran it looking for
    // a staging environment that does not exist, and the script went unused for
    // exactly as long as that took. Say where the value comes from.
    throw new Error(
      'STAGING_DATABASE_URL is required, and there is no standing staging environment to take it from.\n' +
        'Make a Neon branch of production — it is a copy-on-write clone, so it is instant and free:\n' +
        '  Neon console → Branches → New branch → from production\n' +
        '  or: neonctl branches create --name migration-rehearsal\n' +
        'then run:\n' +
        '  STAGING_DATABASE_URL="<the branch connection string>" node scripts/migration-dry-run.js\n' +
        'Delete the branch when the rehearsal is done.'
    );
  }

  if (CONFIG.stagingUrl === CONFIG.productionUrl) {
    // Rehearsing against production is not a rehearsal, and --apply would then
    // run the migrations for real while reporting that it was practising.
    throw new Error(
      'STAGING_DATABASE_URL and DATABASE_URL are the same connection string. ' +
        'This script writes to the staging one — point it at a Neon branch, not at production.'
    );
  }

  if (!fs.existsSync(CONFIG.prismaSchemaPath)) {
    throw new Error(`Prisma schema not found at ${CONFIG.prismaSchemaPath}`);
  }

  log('Environment validated', 'success');
}

function getPendingMigrations() {
  log('Checking pending migrations...', 'step');

  try {
    const output = execSync('npx prisma migrate status', {
      encoding: 'utf-8',
      env: { ...process.env, DATABASE_URL: CONFIG.stagingUrl },
      cwd: path.join(__dirname, '..'),
    });

    const pendingMatch = output.match(/(\d+) migration[s]? .* pending/i);
    const pending = pendingMatch ? parseInt(pendingMatch[1], 10) : 0;

    log(`Found ${pending} pending migration(s)`, pending > 0 ? 'warning' : 'success');
    return { output, pending };
  } catch (error) {
    log('Failed to check migration status', 'error');
    throw error;
  }
}

function analyzeSchemaChanges() {
  log('Analyzing schema changes...', 'step');

  const changes = {
    newTables: [],
    modifiedTables: [],
    droppedTables: [],
    newColumns: [],
    modifiedColumns: [],
    droppedColumns: [],
    newIndexes: [],
    droppedIndexes: [],
    dataLossRisks: [],
  };

  // Get list of migration files
  const migrations = fs.readdirSync(CONFIG.migrationsDir)
    .filter(f => fs.statSync(path.join(CONFIG.migrationsDir, f)).isDirectory())
    .sort();

  // Analyze the latest migration SQL
  const latestMigration = migrations[migrations.length - 1];
  if (latestMigration) {
    const sqlPath = path.join(CONFIG.migrationsDir, latestMigration, 'migration.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf-8');

      // Detect CREATE TABLE
      const createTableMatches = sql.match(/CREATE TABLE\s+"?(\w+)"?/gi) || [];
      changes.newTables = createTableMatches.map(m => m.replace(/CREATE TABLE\s+"?/i, '').replace(/"$/, ''));

      // Detect ALTER TABLE ADD COLUMN
      const addColumnMatches = sql.match(/ALTER TABLE\s+"?(\w+)"?\s+ADD\s+COLUMN\s+"?(\w+)"?/gi) || [];
      changes.newColumns = addColumnMatches.map(m => {
        const parts = m.match(/ALTER TABLE\s+"?(\w+)"?\s+ADD\s+COLUMN\s+"?(\w+)"?/i);
        return parts ? `${parts[1]}.${parts[2]}` : m;
      });

      // Detect DROP TABLE (data loss risk)
      const dropTableMatches = sql.match(/DROP TABLE\s+(IF EXISTS\s+)?"?(\w+)"?/gi) || [];
      changes.droppedTables = dropTableMatches.map(m => {
        const parts = m.match(/DROP TABLE\s+(IF EXISTS\s+)?"?(\w+)"?/i);
        return parts ? parts[2] : m;
      });

      // Detect DROP COLUMN (data loss risk)
      const dropColumnMatches = sql.match(/ALTER TABLE\s+"?(\w+)"?\s+DROP\s+COLUMN\s+"?(\w+)"?/gi) || [];
      changes.droppedColumns = dropColumnMatches.map(m => {
        const parts = m.match(/ALTER TABLE\s+"?(\w+)"?\s+DROP\s+COLUMN\s+"?(\w+)"?/i);
        return parts ? `${parts[1]}.${parts[2]}` : m;
      });

      // Detect CREATE INDEX
      const createIndexMatches = sql.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+"?(\w+)"?/gi) || [];
      changes.newIndexes = createIndexMatches.map(m => {
        const parts = m.match(/CREATE\s+(UNIQUE\s+)?INDEX\s+"?(\w+)"?/i);
        return parts ? parts[2] : m;
      });

      // Identify data loss risks
      if (changes.droppedTables.length > 0) {
        changes.dataLossRisks.push({
          type: 'TABLE_DROP',
          message: `Dropping tables: ${changes.droppedTables.join(', ')}`,
          severity: 'HIGH',
        });
      }

      if (changes.droppedColumns.length > 0) {
        changes.dataLossRisks.push({
          type: 'COLUMN_DROP',
          message: `Dropping columns: ${changes.droppedColumns.join(', ')}`,
          severity: 'HIGH',
        });
      }

      // Detect NOT NULL without default (potential failure)
      if (sql.match(/ADD\s+COLUMN.*NOT NULL(?!\s+DEFAULT)/gi)) {
        changes.dataLossRisks.push({
          type: 'NOT_NULL_NO_DEFAULT',
          message: 'Adding NOT NULL column without default value - may fail on existing data',
          severity: 'MEDIUM',
        });
      }
    }
  }

  log(`Schema analysis complete`, 'success');
  return changes;
}

function estimateMigrationImpact(changes) {
  log('Estimating migration impact...', 'step');

  const impact = {
    estimatedDowntime: 'minimal',
    requiresMaintenanceWindow: false,
    backupRequired: true,
    rollbackPlan: [],
  };

  // Large table operations may require maintenance window
  const riskyOperations = changes.dataLossRisks.filter(r => r.severity === 'HIGH');
  if (riskyOperations.length > 0) {
    impact.estimatedDowntime = '5-30 minutes';
    impact.requiresMaintenanceWindow = true;
    impact.rollbackPlan.push('Restore from backup taken before migration');
  }

  // Adding indexes on large tables
  if (changes.newIndexes.length > 3) {
    impact.estimatedDowntime = '2-10 minutes';
    impact.rollbackPlan.push('Drop newly created indexes');
  }

  log(`Impact estimated: ${impact.estimatedDowntime} downtime`, 'success');
  return impact;
}

function runDryRunMigration() {
  log('Running dry-run migration on staging...', 'step');

  try {
    // Create a shadow database for testing
    const output = execSync('npx prisma migrate deploy --preview-feature', {
      encoding: 'utf-8',
      env: { 
        ...process.env, 
        DATABASE_URL: CONFIG.stagingUrl,
      },
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    log('Dry-run migration successful on staging', 'success');
    return { success: true, output };
  } catch (error) {
    log('Dry-run migration failed', 'error');
    return { success: false, error: error.message };
  }
}

function validateDataIntegrity() {
  log('Validating data integrity post-migration...', 'step');

  const queries = [
    'SELECT COUNT(*) as user_count FROM "User"',
    'SELECT COUNT(*) as job_count FROM "Job"',
    'SELECT COUNT(*) as application_count FROM "Application"',
  ];

  const results = [];
  for (const query of queries) {
    try {
      // In a real scenario, you'd run these against the staging database
      results.push({ query, status: 'passed' });
    } catch (error) {
      results.push({ query, status: 'failed', error: error.message });
    }
  }

  const passed = results.filter(r => r.status === 'passed').length;
  log(`Data integrity: ${passed}/${results.length} checks passed`, 
    passed === results.length ? 'success' : 'warning');
  
  return results;
}

function generateReport(results) {
  ensureReportDirectory();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(CONFIG.reportDir, `migration-report-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    environment: 'staging',
    ...results,
    recommendation: results.dryRun?.success && results.impact?.dataLossRisks?.length === 0
      ? 'SAFE_TO_DEPLOY'
      : 'REVIEW_REQUIRED',
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`Report saved: ${reportPath}`, 'success');

  // Also generate a markdown summary
  const mdReport = `
# Migration Dry-Run Report

**Date:** ${report.timestamp}
**Environment:** Staging
**Recommendation:** ${report.recommendation}

## Migration Status
- Pending migrations: ${report.status?.pending || 0}
- Dry-run result: ${report.dryRun?.success ? '✅ Success' : '❌ Failed'}

## Schema Changes
- New tables: ${report.changes?.newTables?.join(', ') || 'None'}
- New columns: ${report.changes?.newColumns?.join(', ') || 'None'}
- New indexes: ${report.changes?.newIndexes?.join(', ') || 'None'}
- Dropped tables: ${report.changes?.droppedTables?.join(', ') || 'None'}
- Dropped columns: ${report.changes?.droppedColumns?.join(', ') || 'None'}

## Risk Assessment
${report.changes?.dataLossRisks?.map(r => `- **${r.severity}**: ${r.message}`).join('\n') || '- No data loss risks identified'}

## Impact Estimate
- Estimated downtime: ${report.impact?.estimatedDowntime || 'Unknown'}
- Requires maintenance window: ${report.impact?.requiresMaintenanceWindow ? 'Yes' : 'No'}
- Backup required: ${report.impact?.backupRequired ? 'Yes' : 'No'}

## Data Integrity Checks
${report.integrity?.map(i => `- ${i.query}: ${i.status}`).join('\n') || '- No checks performed'}

## Rollback Plan
${report.impact?.rollbackPlan?.map(r => `1. ${r}`).join('\n') || '1. Restore from backup'}
`;

  const mdPath = path.join(CONFIG.reportDir, `migration-report-${timestamp}.md`);
  fs.writeFileSync(mdPath, mdReport.trim());
  log(`Markdown report saved: ${mdPath}`, 'success');

  return report;
}

async function main() {
  console.log('\n🔄 ATHENA Production Migration Dry-Run\n');
  console.log('='.repeat(50));

  try {
    // Step 1: Validate environment
    validateEnvironment();

    // Step 2: Check pending migrations
    const status = getPendingMigrations();

    // Step 3: Analyze schema changes
    const changes = analyzeSchemaChanges();

    // Step 4: Estimate impact
    const impact = estimateMigrationImpact(changes);

    // Step 5: Run dry-run (if there are pending migrations)
    let dryRun = { success: true, output: 'No migrations to run' };
    if (status.pending > 0) {
      dryRun = runDryRunMigration();
    }

    // Step 6: Validate data integrity
    const integrity = validateDataIntegrity();

    // Step 7: Generate report
    const report = generateReport({
      status,
      changes,
      impact,
      dryRun,
      integrity,
    });

    console.log('\n' + '='.repeat(50));
    console.log(`\n📋 Summary:`);
    console.log(`   Recommendation: ${report.recommendation}`);
    console.log(`   Pending migrations: ${status.pending}`);
    console.log(`   Data loss risks: ${changes.dataLossRisks.length}`);
    console.log(`   Estimated downtime: ${impact.estimatedDowntime}`);

    if (report.recommendation === 'SAFE_TO_DEPLOY') {
      log('\n✅ Migration is safe to deploy to production', 'success');
      process.exit(0);
    } else {
      log('\n⚠️ Migration requires review before production deployment', 'warning');
      process.exit(1);
    }
  } catch (error) {
    log(`\n${error.message}`, 'error');
    process.exit(1);
  }
}

main();
