// Auto-generated from 2025_10_22_160831_add_performance_indexes_to_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('jobs')) {
    await knex.schema.alterTable('jobs', (table) => {
      table.index(['featured', 'status', 'deadline'], 'jobs_featured_status_deadline_idx');
      table.index(['status', 'deadline'], 'jobs_status_deadline_idx');
      table.index(['company_id', 'status'], 'jobs_company_status_idx');
      table.index(['job_category_id', 'status'], 'jobs_category_status_idx');
      table.index('slug', 'jobs_slug_idx');
    });
  }

  if (await knex.schema.hasTable('job_bookmarks')) {
    await knex.schema.alterTable('job_bookmarks', (table) => {
      table.index('candidate_id', 'job_bookmarks_candidate_idx');
      table.index(['candidate_id', 'job_id'], 'job_bookmarks_candidate_job_idx');
    });
  }

  if (await knex.schema.hasTable('companies')) {
    await knex.schema.alterTable('companies', (table) => {
      table.index('slug', 'companies_slug_idx');
      table.index('user_id', 'companies_user_idx');
    });
  }

  if (await knex.schema.hasTable('candidates')) {
    await knex.schema.alterTable('candidates', (table) => {
      table.index('user_id', 'candidates_user_idx');
    });
  }

  if (await knex.schema.hasTable('job_categories')) {
    await knex.schema.alterTable('job_categories', (table) => {
      table.index('show_at_featured', 'job_categories_featured_idx');
      table.index('show_at_popular', 'job_categories_popular_idx');
      table.index('slug', 'job_categories_slug_idx');
    });
  }

  if (await knex.schema.hasTable('orders')) {
    await knex.schema.alterTable('orders', (table) => {
      table.index('company_id', 'orders_company_idx');
      table.index('payment_status', 'orders_payment_status_idx');
      table.index(['company_id', 'payment_status'], 'orders_company_payment_idx');
    });
  }

  if (await knex.schema.hasTable('applied_jobs')) {
    await knex.schema.alterTable('applied_jobs', (table) => {
      table.index('job_id', 'applied_jobs_job_idx');
      table.index('candidate_id', 'applied_jobs_candidate_idx');
      table.index(['job_id', 'candidate_id'], 'applied_jobs_job_candidate_idx');
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('jobs')) {
    await knex.schema.alterTable('jobs', (table) => {
      table.dropIndex(['featured', 'status', 'deadline'], 'jobs_featured_status_deadline_idx');
      table.dropIndex(['status', 'deadline'], 'jobs_status_deadline_idx');
      table.dropIndex(['company_id', 'status'], 'jobs_company_status_idx');
      table.dropIndex(['job_category_id', 'status'], 'jobs_category_status_idx');
      table.dropIndex('slug', 'jobs_slug_idx');
    });
  }

  if (await knex.schema.hasTable('job_bookmarks')) {
    await knex.schema.alterTable('job_bookmarks', (table) => {
      table.dropIndex('candidate_id', 'job_bookmarks_candidate_idx');
      table.dropIndex(['candidate_id', 'job_id'], 'job_bookmarks_candidate_job_idx');
    });
  }

  if (await knex.schema.hasTable('companies')) {
    await knex.schema.alterTable('companies', (table) => {
      table.dropIndex('slug', 'companies_slug_idx');
      table.dropIndex('user_id', 'companies_user_idx');
    });
  }

  if (await knex.schema.hasTable('candidates')) {
    await knex.schema.alterTable('candidates', (table) => {
      table.dropIndex('user_id', 'candidates_user_idx');
    });
  }

  if (await knex.schema.hasTable('job_categories')) {
    await knex.schema.alterTable('job_categories', (table) => {
      table.dropIndex('show_at_featured', 'job_categories_featured_idx');
      table.dropIndex('show_at_popular', 'job_categories_popular_idx');
      table.dropIndex('slug', 'job_categories_slug_idx');
    });
  }

  if (await knex.schema.hasTable('orders')) {
    await knex.schema.alterTable('orders', (table) => {
      table.dropIndex('company_id', 'orders_company_idx');
      table.dropIndex('payment_status', 'orders_payment_status_idx');
      table.dropIndex(['company_id', 'payment_status'], 'orders_company_payment_idx');
    });
  }

  if (await knex.schema.hasTable('applied_jobs')) {
    await knex.schema.alterTable('applied_jobs', (table) => {
      table.dropIndex('job_id', 'applied_jobs_job_idx');
      table.dropIndex('candidate_id', 'applied_jobs_candidate_idx');
      table.dropIndex(['job_id', 'candidate_id'], 'applied_jobs_job_candidate_idx');
    });
  }
};
