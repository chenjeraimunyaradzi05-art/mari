// Auto-generated from 2025_11_18_092000_create_social_notification_preferences_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_notification_preferences'))) {
    await knex.schema.createTable('social_notification_preferences', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable().unique();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.json('settings').nullable();
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_notification_preferences');
};
