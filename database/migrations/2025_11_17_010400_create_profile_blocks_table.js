// Auto-generated from 2025_11_17_010400_create_profile_blocks_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('profile_blocks'))) {
    await knex.schema.createTable('profile_blocks', (table) => {
      table.bigIncrements('id');
      table.bigInteger('blocker_profile_id').unsigned().notNullable();
      table.foreign('blocker_profile_id').references('profiles.id').onDelete('CASCADE');
      table.bigInteger('blocked_profile_id').unsigned().notNullable();
      table.foreign('blocked_profile_id').references('profiles.id').onDelete('CASCADE');
      table.text('reason').nullable();
      table.timestamp('blocked_at').defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.unique(['blocker_profile_id', 'blocked_profile_id']);
      table.index('blocked_profile_id');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('profile_blocks');
};
