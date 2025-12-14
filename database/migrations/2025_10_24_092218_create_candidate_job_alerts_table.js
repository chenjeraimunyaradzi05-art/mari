// Auto-generated from 2025_10_24_092218_create_candidate_job_alerts_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('candidate_job_alerts'))) {
    await knex.schema.createTable('candidate_job_alerts', (table) => {
      table.bigIncrements('id');
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.string('name').nullable();
      table.boolean('is_active').notNullable().defaultTo(true);
      table.json('keywords').nullable();
      table.json('job_categories').nullable();
      table.json('job_types').nullable();
      table.json('job_roles').nullable();
      table.json('locations').nullable();
      table.json('salary_range').nullable();
      table.json('experience_levels').nullable();
      table.boolean('email_enabled').notNullable().defaultTo(true);
      table.boolean('sms_enabled').notNullable().defaultTo(false);
      table.boolean('push_enabled').notNullable().defaultTo(true);
      table.string('frequency').notNullable().defaultTo('immediate');
      table.time('preferred_time').nullable();
      table.json('quiet_hours').nullable();
      table.integer('match_threshold').notNullable().defaultTo(70);
      table.json('ai_preferences').nullable();
      table.integer('clicks_count').notNullable().defaultTo(0);
      table.integer('applications_count').notNullable().defaultTo(0);
      table.timestamp('last_sent_at').nullable();
      table.timestamps(true, true);

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.index('candidate_id');
      table.index(['is_active', 'frequency']);
    });
  }

  if (!(await knex.schema.hasTable('job_alert_logs'))) {
    await knex.schema.createTable('job_alert_logs', (table) => {
      table.bigIncrements('id');
      table.bigInteger('alert_id').unsigned().notNullable();
      table.bigInteger('job_id').unsigned().notNullable();
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.integer('match_score').notNullable();
      table.string('channel').notNullable();
      table.enu('status', ['sent', 'failed', 'clicked', 'applied']).notNullable().defaultTo('sent');
      table.timestamp('sent_at').nullable();
      table.timestamp('clicked_at').nullable();
      table.timestamp('applied_at').nullable();
      table.text('error_message').nullable();
      table.timestamps(true, true);

      table.foreign('alert_id').references('id').inTable('candidate_job_alerts').onDelete('CASCADE');
      table.foreign('job_id').references('id').inTable('jobs').onDelete('CASCADE');
      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');

      table.index(['alert_id', 'job_id']);
      table.index(['candidate_id', 'status']);
      table.index('sent_at');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('job_alert_logs');
  await knex.schema.dropTableIfExists('candidate_job_alerts');
};
