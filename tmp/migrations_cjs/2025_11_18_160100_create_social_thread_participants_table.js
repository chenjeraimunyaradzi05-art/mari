// Auto-generated from 2025_11_18_160100_create_social_thread_participants_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_thread_participants'))) {
    await knex.schema.createTable('social_thread_participants', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_thread_id').unsigned().notNullable();
      table.foreign('social_thread_id').references('social_threads.id').onDelete('CASCADE');
      table.bigInteger('social_profile_id').unsigned().notNullable();
      table.foreign('social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.string('role', 32).defaultTo('member');
      table.string('status', 32).defaultTo('active');
      table.timestamp('joined_at').nullable();
      table.timestamp('left_at').nullable();
      table.timestamp('last_read_at').nullable();
      table.bigInteger('last_read_message_id').unsigned().nullable();
      table.timestamp('muted_at').nullable();
      table.boolean('notifications_enabled').defaultTo(true);
      table.json('settings').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.unique(['social_thread_id', 'social_profile_id'], 'st_participants_thread_profile_unique');
      table.index(['social_profile_id', 'status'], 'st_participants_profile_status_idx');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_thread_participants');
};
