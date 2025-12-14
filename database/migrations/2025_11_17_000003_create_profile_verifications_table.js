// Auto-generated from 2025_11_17_000003_create_profile_verifications_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('profile_verifications'))) {
    await knex.schema.createTable('profile_verifications', (table) => {
      table.bigIncrements('id');
      table.bigInteger('profile_id').unsigned().notNullable();
      table.foreign('profile_id').references('profiles.id').onDelete('CASCADE');
      table.enu('request_type', ['government_id', 'organization_email', 'document_upload']).notNullable();
      table.enu('status', ['pending', 'approved', 'rejected', 'needs_more_info']).defaultTo('pending');
      table.json('submitted_data').nullable();
      table.string('reviewed_by').nullable();
      table.timestamp('reviewed_at').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.index(['profile_id', 'status']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('profile_verifications');
};
