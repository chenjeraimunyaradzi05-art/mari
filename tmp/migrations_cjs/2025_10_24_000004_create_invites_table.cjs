// Auto-generated from 2025_10_24_000004_create_invites_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('invites'))) {
    await knex.schema.createTable('invites', (table) => {
      table.bigIncrements('id');
      table.bigInteger('sender_id').unsigned().notNullable();
      table.string('recipient_email').nullable();
      table.string('recipient_phone').nullable();
      table.string('status').notNullable().defaultTo('pending');
      table.string('token').nullable();
      table.string('type').nullable();
      table.text('message').nullable();
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('invites');
};
