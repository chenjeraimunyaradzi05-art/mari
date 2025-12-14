// Auto-generated from 2025_11_18_160000_create_social_threads_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_threads'))) {
    await knex.schema.createTable('social_threads', (table) => {
      table.bigIncrements('id');
      table.bigInteger('created_by_social_profile_id').unsigned().notNullable();
      table.foreign('created_by_social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.string('thread_type', 32).defaultTo('direct');
      table.string('status', 32).defaultTo('active');
      table.string('message_request_mode', 32).defaultTo('followers');
      table.string('subject').nullable();
      table.boolean('is_system').defaultTo(false);
      table.decimal('spam_score', 5, 2).defaultTo(0);
      table.json('metadata').nullable();
      table.bigInteger('last_message_id').unsigned().nullable();
      table.timestamp('last_message_at').nullable();
      table.timestamp('muted_by_system_at').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['thread_type', 'status']);
      table.index('last_message_at');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_threads');
};
