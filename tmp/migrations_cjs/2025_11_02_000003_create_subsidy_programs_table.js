// Auto-generated from 2025_11_02_000003_create_subsidy_programs_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('subsidy_programs'))) {
    await knex.schema.createTable('subsidy_programs', (table) => {
      table.bigIncrements('id');
      table.bigInteger('organization_page_id').unsigned().nullable();
      table.string('name').notNullable();
      table.string('slug').notNullable().unique();
      table.string('category').nullable();
      table.text('summary').nullable();
      table.text('eligibility').nullable();
      table.integer('amount_cents').unsigned().nullable();
      table.integer('coverage_percent').unsigned().nullable();
      table.string('currency', 3).notNullable().defaultTo('USD');
      table.date('starts_on').nullable();
      table.date('ends_on').nullable();
      table.string('status').notNullable().defaultTo('draft');
      table.string('application_url').nullable();
      table.string('contact_email').nullable();
      table.json('meta').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['organization_page_id', 'status']);
      table.index(['starts_on', 'ends_on']);
      table.foreign('organization_page_id').references('id').inTable('organization_pages').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('subsidy_programs');
};
