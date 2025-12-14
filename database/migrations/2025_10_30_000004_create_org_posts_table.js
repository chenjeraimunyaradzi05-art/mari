
// Ported from 2025_10_30_000004_create_org_posts_table.php
exports.up = function(knex) {
  return knex.schema.createTable('org_posts', function(table) {
    table.increments('id').primary();
    table.integer('org_page_id').unsigned().references('id').inTable('organization_pages').onDelete('CASCADE');
    table.text('content', 'longtext').nullable();
    table.bigInteger('media_id').unsigned().nullable();
    table.enu('visibility', ['public','followers']).defaultTo('public').index();
    table.json('tags').nullable();
    table.integer('likes').unsigned().defaultTo(0);
    table.integer('comments').unsigned().defaultTo(0);
    table.integer('shares').unsigned().defaultTo(0);
    table.bigInteger('watch_time').unsigned().defaultTo(0);
    table.timestamps(true, true);
    table.index(['org_page_id','visibility']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('org_posts');
};
