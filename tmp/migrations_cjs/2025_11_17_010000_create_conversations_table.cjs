// Auto-generated from 2025_11_17_010000_create_conversations_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('conversations'))) {
    await knex.schema.createTable('conversations', (table) => {
      table.bigIncrements('id');
      table.enu('type', ['direct', 'group']).defaultTo('direct');
      table.bigInteger('created_by_profile_id').unsigned().notNullable();
      table.foreign('created_by_profile_id').references('profiles.id').onDelete('CASCADE');
      table.string('subject').nullable();
      table.boolean('requires_approval').defaultTo(false);
      table.enu('status', ['pending', 'active', 'archived']).defaultTo('active');
      table.json('metadata').nullable();
      table.timestamp('last_message_at').nullable();
      table.timestamps(true, true);

      table.index(['type', 'status']);
      table.index('last_message_at');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('conversations');
};
