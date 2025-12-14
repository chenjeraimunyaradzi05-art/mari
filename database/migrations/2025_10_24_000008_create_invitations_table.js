// Auto-generated from 2025_10_24_000008_create_invitations_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('invitations'))) {
    await knex.schema.createTable('invitations', (table) => {
      table.bigIncrements('id');
      table.bigInteger('sender_id').unsigned().notNullable();
      table.bigInteger('receiver_id').unsigned().notNullable();
      table.string('type').notNullable();
      table.text('message').nullable();
      table.string('status').notNullable().defaultTo('pending');
      table.timestamps(true, true);

      table.foreign('sender_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('receiver_id').references('id').inTable('users').onDelete('CASCADE');
      table.index('sender_id');
      table.index('receiver_id');
      table.index('status');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('invitations');
};
