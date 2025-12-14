// Auto-generated from 2025_11_12_010100_create_learning_path_enrolments_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('learning_path_enrolments'))) {
    await knex.schema.createTable('learning_path_enrolments', (table) => {
      table.bigIncrements('id');
      table.bigInteger('real_estate_learning_path_id').unsigned().notNullable();
      table.foreign('real_estate_learning_path_id').references('real_estate_learning_paths.id').onDelete('CASCADE');
      table.bigInteger('user_id').unsigned().notNullable();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.enu('enrolment_status', ['active', 'completed', 'dropped']).notNullable().defaultTo('active');
      table.specificType('progress_percent', 'tinyint unsigned').notNullable().defaultTo(0);
      table.text('notes').nullable();
      table.timestamp('last_ai_check_in_at').nullable();
      table.timestamps(true, true);

      table.unique(['real_estate_learning_path_id', 'user_id'], 'learning_path_enrolments_unique_path_user');
      table.index('enrolment_status');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('learning_path_enrolments');
};
