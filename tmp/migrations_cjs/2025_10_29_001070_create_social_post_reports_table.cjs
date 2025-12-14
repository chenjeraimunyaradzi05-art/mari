// Auto-generated from 2025_10_29_001070_create_social_post_reports_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_post_reports')) return;
  await knex.schema.createTable('social_post_reports', (table) => {
    table.bigIncrements('id');
    table.bigInteger('social_post_id').unsigned().notNullable();
    table.bigInteger('reporter_id').unsigned().notNullable();
    table.string('reason', 60).notNullable();
    table.text('details').nullable();
    table.json('meta').nullable();
    table.timestamp('reviewed_at').nullable();
    table.bigInteger('reviewer_id').unsigned().nullable();
    table.string('status', 30).notNullable().defaultTo('pending');
    table.timestamps(true, true);

    table.foreign('social_post_id').references('id').inTable('social_posts').onDelete('CASCADE');
    table.foreign('reporter_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('reviewer_id').references('id').inTable('admins').onDelete('SET NULL');
    table.index(['social_post_id', 'status'], 'spr_post_status_idx');
    table.index(['status', 'created_at'], 'spr_status_created_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_post_reports');
};
