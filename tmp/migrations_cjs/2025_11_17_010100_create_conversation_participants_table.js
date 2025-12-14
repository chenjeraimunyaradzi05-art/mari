// Auto-generated from 2025_11_17_010100_create_conversation_participants_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('conversation_participants'))) {
    await knex.schema.createTable('conversation_participants', (table) => {
      table.bigIncrements('id');
      table.bigInteger('conversation_id').unsigned().notNullable();
      table.foreign('conversation_id').references('conversations.id').onDelete('CASCADE');
      table.bigInteger('profile_id').unsigned().notNullable();
      table.foreign('profile_id').references('profiles.id').onDelete('CASCADE');
      table.enu('role', ['owner', 'member']).defaultTo('member');
      table.enu('status', ['active', 'pending', 'left', 'blocked']).defaultTo('active');
      table.timestamp('last_read_at').nullable();
      table.timestamp('joined_at').nullable();
      table.timestamp('left_at').nullable();
      table.boolean('muted').defaultTo(false);
      table.json('settings').nullable();
      table.timestamps(true, true);

      table.unique(['conversation_id', 'profile_id']);
      table.index(['profile_id', 'status']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('conversation_participants');
};
