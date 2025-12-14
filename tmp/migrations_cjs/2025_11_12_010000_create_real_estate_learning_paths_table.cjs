// Auto-generated from 2025_11_12_010000_create_real_estate_learning_paths_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('real_estate_learning_paths'))) {
    await knex.schema.createTable('real_estate_learning_paths', (table) => {
      table.bigIncrements('id');
      table.string('title').notNullable();
      table.string('slug').notNullable();
      table.unique('slug');
      table.string('path_type', 40).notNullable();
      table.string('difficulty_level', 24).notNullable();
      table.specificType('duration_weeks', 'tinyint unsigned').nullable();
      table.json('modules').nullable();
      table.json('associated_courses').nullable();
      table.boolean('ai_guided').notNullable().defaultTo(true);
      table.json('outcomes').nullable();
      table.text('summary').nullable();
      table.timestamps(true, true);

      table.index(['path_type', 'difficulty_level'], 'real_estate_learning_paths_type_level_idx');
      table.index('ai_guided');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('real_estate_learning_paths');
};
