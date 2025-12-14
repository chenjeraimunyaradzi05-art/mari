const knexLib = require('knex');
const path = require('path');
const files = [
  '2025_11_03_000001_create_organizations_table.cjs',
  '2025_11_03_000002_create_profiles_table.cjs',
  '2025_11_03_000003_create_posts_table.cjs',
  '2025_11_03_000004_create_reactions_table.cjs',
  '2025_11_03_000005_create_comments_table.cjs',
  '2025_11_03_000006_create_follows_table.cjs',
  '2014_12_01_120000_create_phpdebugbar_storage_table.cjs',
  '2013_11_04_163552_posts.cjs',
  '2015_08_17_185144_authors.cjs',
  '2019_01_05_293551_add-role-id-to-menu-items-table.cjs'
];
const tmpDir = path.resolve(__dirname, '..', 'tmp', 'migrations_cjs');
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
