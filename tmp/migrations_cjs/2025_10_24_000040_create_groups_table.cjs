// Auto-generated from 2025_10_24_000040_create_groups_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('groups'))) {
    await knex.schema.createTable('groups', (table) => {
      table.bigIncrements('id');
      table.string('name').notNullable().unique();
      table.text('description', 'longtext').nullable();
      table.bigInteger('created_by').unsigned().notNullable();
      table.string('avatar').nullable();
      table.boolean('is_public').notNullable().defaultTo(true);
      table.integer('members_count').notNullable().defaultTo(1);
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.foreign('created_by').references('id').inTable('users').onDelete('CASCADE');
      table.index('created_by');
      table.index('is_public');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('groups');
};
