// Auto-generated from 2025_10_24_105213_create_gamification_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('candidate_points'))) {
    await knex.schema.createTable('candidate_points', (table) => {
      table.bigIncrements('id');
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.integer('total_points').notNullable().defaultTo(0);
      table.integer('current_level').notNullable().defaultTo(1);
      table.integer('points_to_next_level').notNullable().defaultTo(100);
      table.integer('lifetime_points').notNullable().defaultTo(0);
      table.integer('monthly_points').notNullable().defaultTo(0);
      table.integer('weekly_points').notNullable().defaultTo(0);
      table.date('last_monthly_reset').nullable();
      table.date('last_weekly_reset').nullable();
      table.integer('streak_days').notNullable().defaultTo(0);
      table.date('last_activity_date').nullable();
      table.timestamps(true, true);

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.unique(['candidate_id']);
      table.index('total_points');
      table.index('current_level');
    });
  }

  if (!(await knex.schema.hasTable('point_transactions'))) {
    await knex.schema.createTable('point_transactions', (table) => {
      table.bigIncrements('id');
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.string('action').notNullable();
      table.integer('points').notNullable();
      table.string('description').notNullable();
      table.json('metadata').nullable();
      table.timestamps(true, true);

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.index('candidate_id');
      table.index('action');
      table.index('created_at');
    });
  }

  if (!(await knex.schema.hasTable('badges'))) {
    await knex.schema.createTable('badges', (table) => {
      table.bigIncrements('id');
      table.string('name').notNullable();
      table.string('slug').unique().notNullable();
      table.text('description').nullable();
      table.string('icon').notNullable();
      table.string('color').notNullable();
      table.string('category').notNullable();
      table.string('rarity').notNullable();
      table.json('criteria').nullable();
      table.integer('points_reward').notNullable().defaultTo(0);
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('earned_count').notNullable().defaultTo(0);
      table.timestamps(true, true);

      table.index('category');
      table.index('rarity');
    });
  }

  if (!(await knex.schema.hasTable('candidate_badges'))) {
    await knex.schema.createTable('candidate_badges', (table) => {
      table.bigIncrements('id');
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.bigInteger('badge_id').unsigned().notNullable();
      table.timestamp('earned_at').notNullable();
      table.integer('progress_percentage').notNullable().defaultTo(100);
      table.json('progress_data').nullable();
      table.boolean('is_showcased').notNullable().defaultTo(false);
      table.timestamps(true, true);

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.foreign('badge_id').references('id').inTable('badges').onDelete('CASCADE');
      table.unique(['candidate_id', 'badge_id']);
      table.index('candidate_id');
      table.index('earned_at');
    });
  }

  if (!(await knex.schema.hasTable('challenges'))) {
    await knex.schema.createTable('challenges', (table) => {
      table.bigIncrements('id');
      table.string('title').notNullable();
      table.string('slug').unique().notNullable();
      table.text('description').nullable();
      table.string('type').notNullable();
      table.string('category').notNullable();
      table.json('requirements').nullable();
      table.integer('target_value').notNullable();
      table.integer('points_reward').notNullable();
      table.bigInteger('badge_id').unsigned().nullable();
      table.string('difficulty').notNullable();
      table.date('start_date').nullable();
      table.date('end_date').nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.boolean('is_repeatable').notNullable().defaultTo(false);
      table.integer('participants_count').notNullable().defaultTo(0);
      table.integer('completions_count').notNullable().defaultTo(0);
      table.timestamps(true, true);

      table.foreign('badge_id').references('id').inTable('badges').onDelete('SET NULL');
      table.index('type');
      table.index('category');
      table.index(['is_active', 'start_date', 'end_date']);
    });
  }

  if (!(await knex.schema.hasTable('candidate_challenges'))) {
    await knex.schema.createTable('candidate_challenges', (table) => {
      table.bigIncrements('id');
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.bigInteger('challenge_id').unsigned().notNullable();
      table.string('status').notNullable();
      table.integer('current_progress').notNullable().defaultTo(0);
      table.integer('target_value').notNullable();
      table.integer('progress_percentage').notNullable().defaultTo(0);
      table.timestamp('started_at').notNullable();
      table.timestamp('completed_at').nullable();
      table.timestamp('expires_at').nullable();
      table.json('progress_data').nullable();
      table.timestamps(true, true);

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.foreign('challenge_id').references('id').inTable('challenges').onDelete('CASCADE');
      table.index('candidate_id');
      table.index('status');
      table.index(['candidate_id', 'challenge_id']);
    });
  }

  if (!(await knex.schema.hasTable('leaderboard_rankings'))) {
    await knex.schema.createTable('leaderboard_rankings', (table) => {
      table.bigIncrements('id');
      table.string('leaderboard_type').notNullable();
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.integer('rank').notNullable();
      table.integer('points').notNullable();
      table.integer('level').nullable();
      table.integer('badges_count').nullable();
      table.integer('challenges_completed').nullable();
      table.json('metadata').nullable();
      table.date('period_start').nullable();
      table.date('period_end').nullable();
      table.timestamps(true, true);

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.index(['leaderboard_type', 'rank']);
      table.index(['candidate_id', 'leaderboard_type']);
    });
  }

  if (!(await knex.schema.hasTable('milestones'))) {
    await knex.schema.createTable('milestones', (table) => {
      table.bigIncrements('id');
      table.string('name').notNullable();
      table.text('description').nullable();
      table.string('category').notNullable();
      table.integer('threshold').notNullable();
      table.integer('points_reward').notNullable().defaultTo(0);
      table.bigInteger('badge_id').unsigned().nullable();
      table.string('icon').nullable();
      table.string('color').nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('achieved_count').notNullable().defaultTo(0);
      table.timestamps(true, true);

      table.foreign('badge_id').references('id').inTable('badges').onDelete('SET NULL');
      table.index('category');
    });
  }

  if (!(await knex.schema.hasTable('candidate_milestones'))) {
    await knex.schema.createTable('candidate_milestones', (table) => {
      table.bigIncrements('id');
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.bigInteger('milestone_id').unsigned().notNullable();
      table.timestamp('achieved_at').notNullable();
      table.integer('value_at_achievement').notNullable();
      table.timestamps(true, true);

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.foreign('milestone_id').references('id').inTable('milestones').onDelete('CASCADE');
      table.unique(['candidate_id', 'milestone_id']);
      table.index('candidate_id');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('candidate_milestones');
  await knex.schema.dropTableIfExists('milestones');
  await knex.schema.dropTableIfExists('leaderboard_rankings');
  await knex.schema.dropTableIfExists('candidate_challenges');
  await knex.schema.dropTableIfExists('challenges');
  await knex.schema.dropTableIfExists('candidate_badges');
  await knex.schema.dropTableIfExists('badges');
  await knex.schema.dropTableIfExists('point_transactions');
  await knex.schema.dropTableIfExists('candidate_points');
};
