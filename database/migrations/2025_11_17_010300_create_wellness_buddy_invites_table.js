// Auto-generated from 2025_11_17_010300_create_wellness_buddy_invites_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  await knex.schema.dropTableIfExists('wellness_buddy_invites');
  if (!(await knex.schema.hasTable('wellness_buddy_invites'))) {
    await knex.schema.createTable('wellness_buddy_invites', (table) => {
      table.bigIncrements('id');
      table.bigInteger('requester_profile_id').unsigned().notNullable();
      table.foreign('requester_profile_id').references('profiles.id').onDelete('CASCADE');
      table.bigInteger('target_profile_id').unsigned().notNullable();
      table.foreign('target_profile_id').references('profiles.id').onDelete('CASCADE');
      table.string('activity_type').nullable();
      table.string('location_preference').nullable();
      table.json('preferred_schedule').nullable();
      table.json('comfort_preferences').nullable();
      table.enu('status', ['pending','accepted','declined','withdrawn']).defaultTo('pending');
      table.text('intro_message').nullable();
      table.timestamp('responded_at').nullable();
      table.timestamps(true, true);

      table.unique(['requester_profile_id', 'target_profile_id'], 'wb_invites_requester_target_unique');
      table.index(['target_profile_id', 'status'], 'wb_invites_target_status_index');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('wellness_buddy_invites');
};
