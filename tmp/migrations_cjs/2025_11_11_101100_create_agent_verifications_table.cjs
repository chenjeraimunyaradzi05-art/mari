// Auto-generated from 2025_11_11_101100_create_agent_verifications_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('agent_verifications'))) {
    await knex.schema.createTable('agent_verifications', (table) => {
      table.bigIncrements('id');
      table.bigInteger('agent_id').unsigned().notNullable();
      table.enu('status', ['pending', 'needs_review', 'approved', 'rejected', 'escalated']).notNullable().defaultTo('pending');
      table.string('license_number').nullable();
      table.string('license_type').nullable();
      table.date('license_expiry').nullable();
      table.string('submitted_via').nullable();
      table.string('external_reference').nullable();
      table.json('documents').nullable();
      table.text('review_notes').nullable();
      table.timestamp('submitted_at').nullable();
      table.timestamp('reviewed_at').nullable();
      table.bigInteger('reviewed_by_admin_id').unsigned().nullable();
      table.timestamps(true, true);

      table.index(['status', 'created_at']);
      table.index(['agent_id', 'status']);
      table.foreign('agent_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('reviewed_by_admin_id').references('id').inTable('admins').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('agent_verifications');
};
