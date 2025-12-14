// Auto-generated from 2025_10_24_000006_create_messages_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('messages'))) {
    await knex.schema.createTable('messages', (table) => {
      table.bigIncrements('id');
      table.bigInteger('sender_id').unsigned().notNullable();
      table.bigInteger('receiver_id').unsigned().notNullable();
      table.text('content').notNullable();
      table.string('media').nullable();
      table.boolean('is_read').notNullable().defaultTo(false);
      table.timestamp('read_at').nullable();
      table.timestamps(true, true);

      table.foreign('sender_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('receiver_id').references('id').inTable('users').onDelete('CASCADE');
      table.index('sender_id');
      table.index('receiver_id');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('messages');
};
