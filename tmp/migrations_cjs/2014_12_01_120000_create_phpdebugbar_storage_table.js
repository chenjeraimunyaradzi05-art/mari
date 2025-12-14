// Auto-generated from 2014_12_01_120000_create_phpdebugbar_storage_table.php

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('phpdebugbar'))) {
    await knex.schema.createTable('phpdebugbar', (table) => {
      table.string('id').notNullable();
      table.text('data', 'longtext').notNullable();
      table.string('meta_utime').nullable();
      table.dateTime('meta_datetime').nullable();
      table.string('meta_uri').nullable();
      table.string('meta_ip').nullable();
      table.string('meta_method').nullable();
      table.primary(['id']);
      table.index('meta_utime');
      table.index('meta_datetime');
      table.index('meta_uri');
      table.index('meta_ip');
      table.index('meta_method');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('phpdebugbar');
};
