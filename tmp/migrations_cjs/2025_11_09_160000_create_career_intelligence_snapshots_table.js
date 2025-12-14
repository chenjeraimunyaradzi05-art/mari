// Auto-generated from 2025_11_09_160000_create_career_intelligence_snapshots_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('career_intelligence_snapshots'))) {
    await knex.schema.createTable('career_intelligence_snapshots', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.decimal('trajectory_score', 5, 2).nullable();
      table.integer('learning_hours').unsigned().nullable();
      table.integer('network_reach').unsigned().nullable();
      table.decimal('content_influence', 6, 4).nullable();
      table.string('target_role', 150).nullable();
      table.text('summary').nullable();
      table.timestamp('captured_at').defaultTo(knex.fn.now()).notNullable();
      table.timestamps(true, true);

      table.index(['user_id', 'captured_at']);
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('career_intelligence_snapshots');
};
