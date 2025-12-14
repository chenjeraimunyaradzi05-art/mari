// Auto-generated from 2025_11_03_000001_create_organizations_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('organizations'))) {
    await knex.schema.createTable('organizations', (table) => {
      table.bigIncrements('id');
      table.string('name').notNullable();
      table.enu('type', ['university','tafe_rto','company','government','sole_trader']).notNullable();
      table.text('bio').nullable();
      table.string('website').nullable();
      table.string('avatar_path').nullable();
      table.string('cover_path').nullable();
      table.bigInteger('owner_id').unsigned().nullable();
      table.timestamps(true, true);
    });
    // add FK if users table exists
    if (await knex.schema.hasTable('users')) {
      await knex.schema.alterTable('organizations', (table) => {
        table.foreign('owner_id').references('id').inTable('users').onDelete('SET NULL');
      });
    }
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('organizations');
};
