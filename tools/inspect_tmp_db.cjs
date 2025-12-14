const knexLib = require('knex');
const path = require('path');
(async () => {
  try {
    const knex = knexLib({ client: 'sqlite3', connection: { filename: path.resolve(__dirname, '..', 'tmp', 'dev.sqlite3') }, useNullAsDefault: true });
    const rows = await knex.raw("select name from sqlite_master where type='table'");
    console.log(rows);
    await knex.destroy();
  } catch (err) {
    console.error('inspect error', err.message || err);
    process.exit(1);
  }
})();
