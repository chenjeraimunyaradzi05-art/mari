// Auto-generated from 2025_10_24_102359_create_skill_gap_analysis_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('skill_gap_analyses'))) {
    await knex.schema.createTable('skill_gap_analyses', (table) => {
      table.bigIncrements('id');
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.date('analysis_date').notNullable();
      table.decimal('overall_gap_score', 5, 2).notNullable().defaultTo(0);
      table.json('skill_gaps').nullable();
      table.json('market_insights').nullable();
      table.json('learning_paths').nullable();
      table.json('top_in_demand_skills').nullable();
      table.json('skill_improvements').nullable();
      table.integer('skills_analyzed').notNullable().defaultTo(0);
      table.integer('skills_matched').notNullable().defaultTo(0);
      table.integer('skills_gap').notNullable().defaultTo(0);
      table.decimal('market_competitiveness', 5, 2).notNullable().defaultTo(0);
      table.string('career_level').nullable();
      table.text('ai_recommendations').nullable();
      table.timestamps(true, true);

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.index('candidate_id');
      table.index('analysis_date');
    });
  }

  if (!(await knex.schema.hasTable('learning_resources'))) {
    await knex.schema.createTable('learning_resources', (table) => {
      table.bigIncrements('id');
      table.bigInteger('skill_id').unsigned().notNullable();
      table.string('title').notNullable();
      table.string('type').notNullable();
      table.string('url').nullable();
      table.string('provider').nullable();
      table.integer('duration').nullable();
      table.string('difficulty').notNullable();
      table.decimal('rating', 3, 2).nullable();
      table.text('description').nullable();
      table.decimal('price', 8, 2).nullable();
      table.string('language').notNullable().defaultTo('English');
      table.json('tags').nullable();
      table.boolean('is_certified').notNullable().defaultTo(false);
      table.boolean('is_featured').notNullable().defaultTo(false);
      table.integer('enrollments').notNullable().defaultTo(0);
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamps(true, true);

      table.foreign('skill_id').references('id').inTable('skills').onDelete('CASCADE');
      table.index('skill_id');
      table.index('type');
      table.index('difficulty');
      table.index(['is_active', 'is_featured']);
    });
  }

  if (!(await knex.schema.hasTable('skill_demand_data'))) {
    await knex.schema.createTable('skill_demand_data', (table) => {
      table.bigIncrements('id');
      table.bigInteger('skill_id').unsigned().notNullable();
      table.integer('job_count').notNullable().defaultTo(0);
      table.decimal('avg_salary', 10, 2).nullable();
      table.decimal('growth_rate', 5, 2).notNullable().defaultTo(0);
      table.string('demand_level').notNullable();
      table.integer('demand_rank').nullable();
      table.json('top_industries').nullable();
      table.json('top_locations').nullable();
      table.json('related_skills').nullable();
      table.date('data_date').notNullable();
      table.timestamps(true, true);

      table.foreign('skill_id').references('id').inTable('skills').onDelete('CASCADE');
      table.unique(['skill_id', 'data_date']);
      table.index('demand_level');
      table.index('data_date');
    });
  }

  if (!(await knex.schema.hasTable('candidate_learning_progress'))) {
    await knex.schema.createTable('candidate_learning_progress', (table) => {
      table.bigIncrements('id');
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.bigInteger('learning_resource_id').unsigned().notNullable();
      table.bigInteger('skill_id').unsigned().notNullable();
      table.string('status').notNullable();
      table.integer('progress_percentage').notNullable().defaultTo(0);
      table.timestamp('started_at').nullable();
      table.timestamp('completed_at').nullable();
      table.integer('time_spent').notNullable().defaultTo(0);
      table.decimal('rating', 3, 2).nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.foreign('learning_resource_id').references('id').inTable('learning_resources').onDelete('CASCADE');
      table.foreign('skill_id').references('id').inTable('skills').onDelete('CASCADE');
      table.index('candidate_id');
      table.index('status');
      table.unique(['candidate_id', 'learning_resource_id'], 'candidate_resource_unique');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('candidate_learning_progress');
  await knex.schema.dropTableIfExists('skill_demand_data');
  await knex.schema.dropTableIfExists('learning_resources');
  await knex.schema.dropTableIfExists('skill_gap_analyses');
};
