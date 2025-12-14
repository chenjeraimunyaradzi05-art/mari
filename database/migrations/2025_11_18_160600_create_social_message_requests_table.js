// Auto-generated from 2025_11_18_160600_create_social_message_requests_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_message_requests'))) {
    await knex.schema.createTable('social_message_requests', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_thread_id').unsigned().notNullable();
      table.foreign('social_thread_id').references('social_threads.id').onDelete('CASCADE');
      table.bigInteger('requester_social_profile_id').unsigned().notNullable();
      table.foreign('requester_social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.bigInteger('target_social_profile_id').unsigned().notNullable();
      table.foreign('target_social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.string('status', 32).defaultTo('pending');
      table.bigInteger('decision_by_social_profile_id').unsigned().nullable();
      table.foreign('decision_by_social_profile_id').references('social_profiles.id').onDelete('SET NULL');
      table.timestamp('expires_at').nullable();
      table.string('auto_action', 32).nullable();
      table.json('context').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.unique(['social_thread_id', 'target_social_profile_id'], 'sm_requests_thread_target_unique');
      table.index(['target_social_profile_id', 'status'], 'sm_requests_target_status_idx');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_message_requests');
};
