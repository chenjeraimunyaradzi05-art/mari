// Auto-generated from 2025_11_03_000002_create_profiles_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('profiles'))) {
    await knex.schema.createTable('profiles', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().nullable();
      table.bigInteger('organization_id').unsigned().nullable();
      table.enu('type', ['candidate','trainee','provider','sole_trader','company','government']).notNullable();
      table.string('display_name').notNullable();
      table.string('handle').notNullable().unique();
      table.text('bio').nullable();
      table.string('avatar_path').nullable();
      table.string('banner_path').nullable();
      table.json('links_json').nullable();
      table.timestamps(true, true);
    });
    // add FKs if referenced tables exist
    if (await knex.schema.hasTable('users')) {
      await knex.schema.alterTable('profiles', (table) => {
        table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
      });
    }
    if (await knex.schema.hasTable('organizations')) {
      await knex.schema.alterTable('profiles', (table) => {
        table.foreign('organization_id').references('id').inTable('organizations').onDelete('SET NULL');
      });
    }
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('profiles');
};
