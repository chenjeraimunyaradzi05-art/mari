// Auto-generated from 2025_10_24_000005_create_group_members_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('group_members'))) {
    await knex.schema.createTable('group_members', (table) => {
      table.bigIncrements('id');
      table.bigInteger('group_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().notNullable();
      table.string('role').notNullable().defaultTo('member');
      table.timestamp('joined_at').nullable();
      table.timestamps(true, true);

      table.foreign('group_id').references('id').inTable('groups').onDelete('CASCADE');
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.unique(['group_id', 'user_id']);
      table.index('user_id');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('group_members');
};
