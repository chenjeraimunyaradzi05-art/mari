// Auto-generated from 2025_11_17_120100_create_social_profile_verifications_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_profile_verifications'))) {
    await knex.schema.createTable('social_profile_verifications', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_profile_id').unsigned().notNullable();
      table.foreign('social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.bigInteger('user_id').unsigned().notNullable();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.enu('request_type', ['government_id', 'organization_email', 'document_upload']).notNullable();
      table.enu('status', ['pending', 'approved', 'rejected', 'needs_more_info']).defaultTo('pending');
      table.json('evidence_urls').nullable();
      table.json('attachments').nullable();
      table.text('notes').nullable();
      table.text('review_notes').nullable();
      table.bigInteger('reviewed_by').unsigned().nullable();
      table.foreign('reviewed_by').references('admins.id').onDelete('SET NULL');
      table.timestamp('submitted_at').nullable();
      table.timestamp('reviewed_at').nullable();
      table.timestamps(true, true);

      table.index(['status', 'submitted_at']);
      table.index(['social_profile_id', 'status']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_profile_verifications');
};
