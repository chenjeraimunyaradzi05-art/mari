// Auto-generated from 2025_11_02_000001_create_apprenticeship_competencies_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('apprenticeship_competencies'))) {
    await knex.schema.createTable('apprenticeship_competencies', (table) => {
      table.bigIncrements('id');
      table.bigInteger('apprenticeship_program_id').unsigned().notNullable();
      table.string('title').notNullable();
      table.string('slug').nullable();
      table.string('category').nullable();
      table.smallint('sequence').unsigned().notNullable().defaultTo(1);
      table.integer('weight').unsigned().notNullable().defaultTo(1);
      table.text('description').nullable();
      table.text('expected_outcomes').nullable();
      table.json('meta').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.unique(['apprenticeship_program_id', 'slug'], 'appr_program_slug_unique');
      table.index(['apprenticeship_program_id', 'sequence'], 'appr_program_sequence_idx');

      table.foreign('apprenticeship_program_id').references('id').inTable('apprenticeship_programs').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('apprenticeship_competencies');
};
