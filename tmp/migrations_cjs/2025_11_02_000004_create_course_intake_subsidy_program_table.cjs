// Auto-generated from 2025_11_02_000004_create_course_intake_subsidy_program_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('course_intake_subsidy_program'))) {
    await knex.schema.createTable('course_intake_subsidy_program', (table) => {
      table.bigIncrements('id');
      table.bigInteger('course_intake_id').unsigned().notNullable();
      table.bigInteger('subsidy_program_id').unsigned().notNullable();
      table.integer('max_claims').unsigned().nullable();
      table.enu('status', ['active', 'inactive']).notNullable().defaultTo('active');
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.unique(['course_intake_id', 'subsidy_program_id'], 'course_intake_subsidy_unique');
      table.foreign('course_intake_id').references('id').inTable('course_intakes').onDelete('CASCADE');
      table.foreign('subsidy_program_id').references('id').inTable('subsidy_programs').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('course_intake_subsidy_program');
};
