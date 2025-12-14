const knexLib = require('knex');
const fs = require('fs');
const path = require('path');

const config = {
  client: 'sqlite3',
  connection: { filename: path.resolve(__dirname, '..', 'tmp', 'dev.sqlite3') },
  useNullAsDefault: true,
  migrations: { directory: path.resolve(__dirname, '..', 'database', 'migrations') }
};

(async () => {
  try {
    if (!fs.existsSync(path.resolve(__dirname, '..', 'tmp'))) fs.mkdirSync(path.resolve(__dirname, '..', 'tmp'));
    const knex = knexLib(config);
    console.log('Running migrations...');
    const [batchNo, log] = await knex.migrate.latest(config);
    console.log('Migrated batch', batchNo);
    console.log('Migrations:', log);
    await knex.destroy();
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
})();
