// Auto-generated from 2025_11_14_121500_create_women_cohort_partner_dashboard_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  // women_cohort_profiles
  if (!(await knex.schema.hasTable('women_cohort_profiles'))) {
    await knex.schema.createTable('women_cohort_profiles', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.string('persona').defaultTo('learner');
      table.json('financial_profile').nullable();
      table.json('education_profile').nullable();
      table.json('ai_insights').nullable();
      table.json('preferences').nullable();
      table.timestamps(true, true);

      table.unique('user_id');
      table.index('persona');
    });
  }

  // women_cohort_enrolments
  if (!(await knex.schema.hasTable('women_cohort_enrolments'))) {
    await knex.schema.createTable('women_cohort_enrolments', (table) => {
      table.bigIncrements('id');
      table.bigInteger('profile_id').unsigned().notNullable();
      table.foreign('profile_id').references('women_cohort_profiles.id').onDelete('CASCADE');
      table.string('cohort_slug').notNullable();
      table.string('role').defaultTo('learner');
      table.string('status').defaultTo('active');
      table.timestamp('joined_at').nullable();
      table.timestamp('left_at').nullable();
      table.timestamps(true, true);

      table.unique(['profile_id', 'cohort_slug']);
      table.index(['cohort_slug', 'status']);
    });
  }

  // women_partner_projects
  if (!(await knex.schema.hasTable('women_partner_projects'))) {
    await knex.schema.createTable('women_partner_projects', (table) => {
      table.bigIncrements('id');
      table.bigInteger('owner_id').unsigned().notNullable();
      table.foreign('owner_id').references('users.id').onDelete('CASCADE');
      table.string('title').notNullable();
      table.string('slug').unique();
      table.string('status').defaultTo('draft');
      table.text('summary').nullable();
      table.json('capital_stack').nullable();
      table.json('ai_insights').nullable();
      table.timestamp('target_launch_at').nullable();
      table.timestamps(true, true);

      table.index(['owner_id', 'status']);
    });
  }

  // women_partner_matches
  if (!(await knex.schema.hasTable('women_partner_matches'))) {
    await knex.schema.createTable('women_partner_matches', (table) => {
      table.bigIncrements('id');
      table.bigInteger('project_id').unsigned().notNullable();
      table.foreign('project_id').references('women_partner_projects.id').onDelete('CASCADE');
      table.bigInteger('profile_id').unsigned().notNullable();
      table.foreign('profile_id').references('women_cohort_profiles.id').onDelete('CASCADE');
      table.decimal('match_score', 5, 2).nullable();
      table.decimal('confidence', 5, 2).nullable();
      table.string('status').defaultTo('pending');
      table.json('notes').nullable();
      table.timestamps(true, true);

      table.unique(['project_id', 'profile_id']);
      table.index(['profile_id', 'status']);
    });
  }

  // women_goal_trackers
  if (!(await knex.schema.hasTable('women_goal_trackers'))) {
    await knex.schema.createTable('women_goal_trackers', (table) => {
      table.bigIncrements('id');
      table.bigInteger('profile_id').unsigned().notNullable();
      table.foreign('profile_id').references('women_cohort_profiles.id').onDelete('CASCADE');
      table.string('goal_type').notNullable();
      table.decimal('target_amount', 14, 2).nullable();
      table.decimal('current_amount', 14, 2).defaultTo(0);
      table.decimal('progress_percent', 5, 2).defaultTo(0);
      table.timestamp('due_at').nullable();
      table.json('ai_nudges').nullable();
      table.timestamps(true, true);

      table.index(['profile_id', 'goal_type']);
    });
  }

  // women_dashboard_preferences
  if (!(await knex.schema.hasTable('women_dashboard_preferences'))) {
    await knex.schema.createTable('women_dashboard_preferences', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.string('persona').nullable();
      table.json('layout').nullable();
      table.json('settings').nullable();
      table.timestamps(true, true);

      table.unique('user_id');
    });
  }

  // women_dashboard_widgets
  if (!(await knex.schema.hasTable('women_dashboard_widgets'))) {
    await knex.schema.createTable('women_dashboard_widgets', (table) => {
      table.bigIncrements('id');
      table.bigInteger('preference_id').unsigned().notNullable();
      table.foreign('preference_id').references('women_dashboard_preferences.id').onDelete('CASCADE');
      table.string('widget').notNullable();
      table.integer('position').unsigned().defaultTo(0);
      table.boolean('pinned').defaultTo(false);
      table.json('config').nullable();
      table.timestamps(true, true);

      table.unique(['preference_id', 'widget']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('women_dashboard_widgets');
  await knex.schema.dropTableIfExists('women_dashboard_preferences');
  await knex.schema.dropTableIfExists('women_goal_trackers');
  await knex.schema.dropTableIfExists('women_partner_matches');
  await knex.schema.dropTableIfExists('women_partner_projects');
  await knex.schema.dropTableIfExists('women_cohort_enrolments');
  await knex.schema.dropTableIfExists('women_cohort_profiles');
};
