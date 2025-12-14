// Auto-generated from 2025_10_24_100324_create_interview_coach_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('interview_questions'))) {
    await knex.schema.createTable('interview_questions', (table) => {
      table.bigIncrements('id');
      table.string('question').notNullable();
      table.text('description').nullable();
      table.enu('type', ['behavioral', 'technical', 'situational', 'competency', 'case_study']).notNullable();
      table.enu('difficulty', ['entry', 'mid', 'senior', 'executive']).notNullable();
      table.bigInteger('job_category_id').unsigned().nullable();
      table.bigInteger('job_role_id').unsigned().nullable();
      table.json('keywords').nullable();
      table.text('sample_answer').nullable();
      table.json('evaluation_criteria').nullable();
      table.integer('time_limit').notNullable().defaultTo(300);
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('usage_count').notNullable().defaultTo(0);
      table.decimal('avg_score', 5, 2).notNullable().defaultTo(0);
      table.timestamps(true, true);

      table.index(['type', 'difficulty', 'is_active']);
      table.index('job_category_id');
      table.index('job_role_id');
    });
  }

  if (!(await knex.schema.hasTable('interview_sessions'))) {
    await knex.schema.createTable('interview_sessions', (table) => {
      table.bigIncrements('id');
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.string('title').notNullable();
      table.enu('session_type', ['quick_practice', 'full_mock', 'focused_topic', 'custom']).notNullable();
      table.bigInteger('job_category_id').unsigned().nullable();
      table.bigInteger('job_role_id').unsigned().nullable();
      table.enu('difficulty', ['entry', 'mid', 'senior', 'executive']).notNullable();
      table.integer('total_questions').notNullable().defaultTo(0);
      table.integer('answered_questions').notNullable().defaultTo(0);
      table.enu('status', ['in_progress', 'completed', 'abandoned']).notNullable().defaultTo('in_progress');
      table.timestamp('started_at').nullable();
      table.timestamp('completed_at').nullable();
      table.integer('total_time_spent').notNullable().defaultTo(0);
      table.decimal('overall_score', 5, 2).nullable();
      table.json('ai_feedback').nullable();
      table.json('strengths').nullable();
      table.json('improvements').nullable();
      table.json('recommended_topics').nullable();
      table.timestamps(true, true);

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.index(['candidate_id', 'status']);
      table.index('created_at');
    });
  }

  if (!(await knex.schema.hasTable('interview_answers'))) {
    await knex.schema.createTable('interview_answers', (table) => {
      table.bigIncrements('id');
      table.bigInteger('interview_session_id').unsigned().notNullable();
      table.bigInteger('interview_question_id').unsigned().notNullable();
      table.text('answer').notNullable();
      table.integer('time_taken').notNullable().defaultTo(0);
      table.decimal('score', 5, 2).nullable();
      table.json('ai_analysis').nullable();
      table.json('strengths').nullable();
      table.json('weaknesses').nullable();
      table.json('keywords_used').nullable();
      table.json('keywords_missed').nullable();
      table.integer('word_count').notNullable().defaultTo(0);
      table.decimal('clarity_score', 5, 2).nullable();
      table.decimal('relevance_score', 5, 2).nullable();
      table.decimal('depth_score', 5, 2).nullable();
      table.decimal('confidence_score', 5, 2).nullable();
      table.text('improvement_tip').nullable();
      table.timestamps(true, true);

      table.foreign('interview_session_id').references('id').inTable('interview_sessions').onDelete('CASCADE');
      table.foreign('interview_question_id').references('id').inTable('interview_questions').onDelete('CASCADE');
      table.index('interview_session_id');
      table.index('interview_question_id');
    });
  }

  if (!(await knex.schema.hasTable('interview_question_topics'))) {
    await knex.schema.createTable('interview_question_topics', (table) => {
      table.bigIncrements('id');
      table.string('name').notNullable();
      table.string('slug').unique().notNullable();
      table.text('description').nullable();
      table.string('icon').notNullable().defaultTo('fas fa-bookmark');
      table.string('color').notNullable().defaultTo('#E91E8C');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('interview_question_topic'))) {
    await knex.schema.createTable('interview_question_topic', (table) => {
      table.bigInteger('interview_question_id').unsigned().notNullable();
      table.bigInteger('interview_question_topic_id').unsigned().notNullable();
      table.primary(['interview_question_id', 'interview_question_topic_id'], { constraintName: 'iq_topic_primary' });
      table.foreign('interview_question_id').references('id').inTable('interview_questions').onDelete('CASCADE');
      table.foreign('interview_question_topic_id').references('id').inTable('interview_question_topics').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('interview_question_topic');
  await knex.schema.dropTableIfExists('interview_question_topics');
  await knex.schema.dropTableIfExists('interview_answers');
  await knex.schema.dropTableIfExists('interview_sessions');
  await knex.schema.dropTableIfExists('interview_questions');
};
