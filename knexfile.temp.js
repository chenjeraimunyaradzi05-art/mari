module.exports = {
  client: 'sqlite3',
  connection: {
    filename: './tmp/dev.sqlite3'
  },
  useNullAsDefault: true,
  migrations: {
    directory: './database/migrations',
  },
};
