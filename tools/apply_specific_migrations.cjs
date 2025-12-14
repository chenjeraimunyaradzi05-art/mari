const knexLib = require('knex');
const path = require('path');
let files = []; // empty -> apply all .cjs files in tmp/migrations_cjs
const tmpDir = path.resolve(__dirname, '..', 'tmp', 'migrations_cjs');

// If files is empty or not defined, fallback to all .cjs files in tmpDir sorted by name
if (!files || files.length === 0) {
  files = require('fs').readdirSync(tmpDir).filter(f => f.endsWith('.cjs')).sort();
}
(async () => {
  const knex = knexLib({ client: 'sqlite3', connection: { filename: path.resolve(__dirname, '..', 'tmp', 'dev.sqlite3') }, useNullAsDefault: true });
  try {
    for (const f of files) {
      const p = path.resolve(tmpDir, f);
      console.log('Applying', f, 'from', p);
      const mig = require(p);
      if (!mig || typeof mig.up !== 'function') {
        console.warn('Skipping (no up):', f);
        continue;
      }
      await mig.up(knex);
      console.log('Applied', f);
    }
    await knex.destroy();
  } catch (err) {
    console.error('Error applying migrations:', err);
    await knex.destroy();
    process.exit(1);
  }
})();
