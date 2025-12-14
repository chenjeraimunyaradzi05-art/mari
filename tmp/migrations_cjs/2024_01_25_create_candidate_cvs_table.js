// Auto-generated from 2024_01_25_create_candidate_cvs_table.php
exports.up = function(knex) {
  return knex.schema.createTable('candidate_cvs', function(table) {
    table.bigIncrements('id');
    table.bigInteger('candidate_id').unsigned().notNullable();
    table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
    table.string('title').defaultTo('My Resume');
    table.string('template').defaultTo('modern');
    table.string('slug').unique();
    table.text('professional_summary').nullable();
    table.string('phone').nullable();
    table.string('email').nullable();
    table.string('website').nullable();
    table.string('linkedin').nullable();
    table.string('github').nullable();
    table.string('location').nullable();
    table.json('work_experience').nullable();
    table.json('education').nullable();
    table.json('skills').nullable();
    table.json('certifications').nullable();
    table.json('projects').nullable();
    table.json('languages').nullable();
    table.json('achievements').nullable();
    table.json('custom_sections').nullable();
    table.json('ai_suggestions').nullable();
    table.integer('ats_score').defaultTo(0);
    table.json('keyword_optimization').nullable();
    table.json('improvement_tips').nullable();
    table.string('share_token').unique().nullable();
    table.boolean('is_public').defaultTo(false);
    table.integer('view_count').defaultTo(0);
    table.integer('download_count').defaultTo(0);
    table.integer('share_count').defaultTo(0);
    table.string('pdf_path').nullable();
    table.timestamp('pdf_generated_at').nullable();
    table.integer('version').defaultTo(1);
    table.boolean('is_active').defaultTo(true);
    table.string('meta_title').nullable();
    table.text('meta_description').nullable();
    table.string('og_image').nullable();
    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();
    table.index('candidate_id');
    table.index('slug');
    table.index('share_token');
    table.index('is_public');
    table.index(['candidate_id', 'is_active']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('candidate_cvs');
};
