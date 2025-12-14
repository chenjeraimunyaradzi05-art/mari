const knexLib = require('knex');
const fs = require('fs');
const path = require('path');

const tmpDir = path.resolve(__dirname, '..', 'tmp', 'migrations_cjs');
const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.cjs')).sort();

const batchSize = parseInt(process.argv[2] || process.env.BATCH_SIZE || '20', 10);
const start = parseInt(process.argv[3] || process.env.BATCH_START || '0', 10);
const subset = files.slice(start, start + batchSize);

(async () => {
  const knex = knexLib({ client: 'sqlite3', connection: { filename: path.resolve(__dirname, '..', 'tmp', 'dev.sqlite3') }, useNullAsDefault: true });
  try {
    console.log('Applying batch', start, 'size', subset.length);
    for (const f of subset) {
      const p = path.resolve(tmpDir, f);
      console.log('Applying', f);
      const mig = require(p);
      if (!mig || typeof mig.up !== 'function') {
        console.warn('Skipping (no up):', f);
        continue;
      }
      try {
        await mig.up(knex);
        console.log('Applied', f);
      } catch (err) {
        const msg = String(err && (err.message || err));
        if (msg.includes('already exists') || msg.includes('SQLITE_ERROR: table')) {
          console.warn('Skipping (already exists):', f, '-', msg.split('\n')[0]);
          continue;
        }
        throw err;
      }
    }
    await knex.destroy();
    console.log('Batch completed');
  } catch (err) {
    console.error('Batch error:', err);
    await knex.destroy();
    process.exit(1);
  }
})();
