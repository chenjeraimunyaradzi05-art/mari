const knexLib = require('knex');
const fs = require('fs');
const path = require('path');

const tmpDir = path.resolve(__dirname, '..', 'tmp');
const dbFile = path.resolve(tmpDir, 'dev.sqlite3');
const migrationsDir = path.resolve(tmpDir, 'migrations_cjs');

(async () => {
  try {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);

    if (!fs.existsSync(migrationsDir)) {
      console.error('Migrations directory not found:', migrationsDir);
      process.exit(1);
    }

    const config = {
      client: 'sqlite3',
      connection: { filename: dbFile },
      useNullAsDefault: true,
      migrations: { directory: migrationsDir, loadExtensions: ['.cjs'] }
    };

    const knex = knexLib(config);
    console.log('Running full knex migrate:latest against new', dbFile);
    const [batchNo, log] = await knex.migrate.latest(config);
    console.log('Migrated batch', batchNo);
    console.log('Migrations applied:', log.length);
    await knex.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
