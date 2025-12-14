// Auto-generated from 2025_10_24_000070_create_notifications_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('notifications'))) {
    await knex.schema.createTable('notifications', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.string('type').notNullable();
      table.text('message', 'longtext').notNullable();
      table.string('action_url').nullable();
      table.boolean('is_read').notNullable().defaultTo(false);
      table.timestamp('read_at').nullable();
      table.timestamps(true, true);

      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.index('user_id');
      table.index('is_read');
      table.index('created_at');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('notifications');
};
