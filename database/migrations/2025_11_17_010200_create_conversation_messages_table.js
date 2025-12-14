// Auto-generated from 2025_11_17_010200_create_conversation_messages_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('conversation_messages'))) {
    await knex.schema.createTable('conversation_messages', (table) => {
      table.bigIncrements('id');
      table.bigInteger('conversation_id').unsigned().notNullable();
      table.foreign('conversation_id').references('conversations.id').onDelete('CASCADE');
      table.bigInteger('sender_profile_id').unsigned().notNullable();
      table.foreign('sender_profile_id').references('profiles.id').onDelete('CASCADE');
      table.enu('message_type', ['text', 'media', 'post_share', 'system']).defaultTo('text');
      table.text('body').nullable();
      table.json('attachments').nullable();
      table.string('shareable_type').nullable();
      table.bigInteger('shareable_id').unsigned().nullable();
      table.boolean('is_system').defaultTo(false);
      table.timestamp('sent_at').nullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.index(['conversation_id', 'sent_at']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('conversation_messages');
};
