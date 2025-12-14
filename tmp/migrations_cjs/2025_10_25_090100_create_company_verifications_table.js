// Auto-generated from 2025_10_25_090100_create_company_verifications_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('company_verifications')) return;
  await knex.schema.createTable('company_verifications', (table) => {
    table.bigIncrements('id');
    table.bigInteger('company_id').unsigned().notNullable();
    table.string('status', 50).notNullable().defaultTo('pending');
    table.bigInteger('reviewer_id').unsigned().nullable();
    table.json('documents').nullable();
    table.text('notes').nullable();
    table.timestamp('submitted_at').nullable();
    table.timestamp('reviewed_at').nullable();
    table.string('evidence_path').nullable();
    table.string('source', 50).notNullable().defaultTo('dashboard');
    table.json('metadata').nullable();
    table.timestamps(true, true);

    table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.foreign('reviewer_id').references('id').inTable('admins').onDelete('SET NULL');
    table.index('status');
    table.index(['company_id', 'status']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('company_verifications');
};
