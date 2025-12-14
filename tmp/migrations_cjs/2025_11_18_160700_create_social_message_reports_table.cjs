// Auto-generated from 2025_11_18_160700_create_social_message_reports_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_message_reports'))) {
    await knex.schema.createTable('social_message_reports', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_message_id').unsigned().notNullable();
      table.foreign('social_message_id').references('social_messages.id').onDelete('CASCADE');
      table.bigInteger('reporter_social_profile_id').unsigned().notNullable();
      table.foreign('reporter_social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.bigInteger('incident_report_id').unsigned().nullable();
      table.foreign('incident_report_id').references('incident_reports.id').onDelete('SET NULL');
      table.string('reason').nullable();
      table.text('notes').nullable();
      table.string('status', 32).defaultTo('open');
      table.bigInteger('resolved_by_social_profile_id').unsigned().nullable();
      table.foreign('resolved_by_social_profile_id').references('social_profiles.id').onDelete('SET NULL');
      table.timestamp('resolved_at').nullable();
      table.json('metadata').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['status', 'resolved_at']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_message_reports');
};
