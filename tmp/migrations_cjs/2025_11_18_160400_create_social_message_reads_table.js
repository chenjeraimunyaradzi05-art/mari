// Auto-generated from 2025_11_18_160400_create_social_message_reads_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_message_reads'))) {
    await knex.schema.createTable('social_message_reads', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_message_id').unsigned().notNullable();
      table.foreign('social_message_id').references('social_messages.id').onDelete('CASCADE');
      table.bigInteger('social_thread_participant_id').unsigned().notNullable();
      table.foreign('social_thread_participant_id').references('social_thread_participants.id').onDelete('CASCADE');
      table.timestamp('delivered_at').nullable();
      table.timestamp('read_at').nullable();
      table.string('device').nullable();
      table.json('context').nullable();
      table.timestamps(true, true);

      table.unique(['social_message_id', 'social_thread_participant_id'], 'sm_reads_message_participant_unique');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_message_reads');
};
