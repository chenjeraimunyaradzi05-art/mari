// Auto-generated from 2025_10_24_081246_add_composite_indexes_for_ai_performance.php
// Ported from Laravel migration to Knex up/down

async function indexExists(knex, tableName, indexName) {
  const client = (knex.client && knex.client.config && knex.client.config.client) || '';
  if (!['mysql', 'mysql2'].includes(client)) return false;
  const result = await knex.raw('SHOW INDEX FROM ??', [tableName]);
  const rows = result && (result[0] || result);
  if (!rows) return false;
  return rows.some((r) => r.Key_name === indexName);
}

exports.up = async function(knex) {
  const client = (knex.client && knex.client.config && knex.client.config.client) || '';
  if (!['mysql', 'mysql2'].includes(client)) {
    return;
  }

  if (await knex.schema.hasTable('applied_jobs')) {
    if (!(await indexExists(knex, 'applied_jobs', 'idx_applied_jobs_candidate_job'))) {
      await knex.schema.alterTable('applied_jobs', (table) => {
        table.index(['candidate_id', 'job_id'], 'idx_applied_jobs_candidate_job');
      });
    }
    if (!(await indexExists(knex, 'applied_jobs', 'idx_applied_jobs_job_date'))) {
      await knex.schema.alterTable('applied_jobs', (table) => {
        table.index(['job_id', 'created_at'], 'idx_applied_jobs_job_date');
      });
    }
  }

  if (await knex.schema.hasTable('candidate_cvs')) {
    if (!(await indexExists(knex, 'candidate_cvs', 'idx_candidate_cvs_active'))) {
      await knex.schema.alterTable('candidate_cvs', (table) => {
        table.index(['candidate_id', 'is_active'], 'idx_candidate_cvs_active');
      });
    }
    if (!(await indexExists(knex, 'candidate_cvs', 'idx_candidate_cvs_public'))) {
      await knex.schema.alterTable('candidate_cvs', (table) => {
        table.index(['is_public', 'created_at'], 'idx_candidate_cvs_public');
      });
    }
  }

  if (await knex.schema.hasTable('jobs')) {
    if (!(await indexExists(knex, 'jobs', 'idx_jobs_company_status'))) {
      await knex.schema.alterTable('jobs', (table) => {
        table.index(['company_id', 'status', 'deadline'], 'idx_jobs_company_status');
      });
    }
    if (!(await indexExists(knex, 'jobs', 'idx_jobs_category_status'))) {
      await knex.schema.alterTable('jobs', (table) => {
        table.index(['job_category_id', 'status'], 'idx_jobs_category_status');
      });
    }
    if (!(await indexExists(knex, 'jobs', 'idx_jobs_active_featured'))) {
      await knex.schema.alterTable('jobs', (table) => {
        table.index(['status', 'featured', 'deadline'], 'idx_jobs_active_featured');
      });
    }
  }

  if (await knex.schema.hasTable('candidates')) {
    if (!(await indexExists(knex, 'candidates', 'idx_candidates_user_status'))) {
      await knex.schema.alterTable('candidates', (table) => {
        table.index(['user_id', 'status'], 'idx_candidates_user_status');
      });
    }
    if (!(await indexExists(knex, 'candidates', 'idx_candidates_profession'))) {
      await knex.schema.alterTable('candidates', (table) => {
        table.index(['profession_id', 'status'], 'idx_candidates_profession');
      });
    }
  }

  if (await knex.schema.hasTable('job_bookmarks')) {
    if (!(await indexExists(knex, 'job_bookmarks', 'idx_bookmarks_candidate_job'))) {
      await knex.schema.alterTable('job_bookmarks', (table) => {
        table.index(['candidate_id', 'job_id'], 'idx_bookmarks_candidate_job');
      });
    }
  }
};

exports.down = async function(knex) {
  const client = (knex.client && knex.client.config && knex.client.config.client) || '';
  if (!['mysql', 'mysql2'].includes(client)) {
    return;
  }

  if (await knex.schema.hasTable('applied_jobs')) {
    await knex.schema.alterTable('applied_jobs', (table) => {
      table.dropIndex(['candidate_id', 'job_id'], 'idx_applied_jobs_candidate_job');
      table.dropIndex(['job_id', 'created_at'], 'idx_applied_jobs_job_date');
    });
  }

  if (await knex.schema.hasTable('candidate_cvs')) {
    await knex.schema.alterTable('candidate_cvs', (table) => {
      table.dropIndex(['candidate_id', 'is_active'], 'idx_candidate_cvs_active');
      table.dropIndex(['is_public', 'created_at'], 'idx_candidate_cvs_public');
    });
  }

  if (await knex.schema.hasTable('jobs')) {
    await knex.schema.alterTable('jobs', (table) => {
      table.dropIndex(['company_id', 'status', 'deadline'], 'idx_jobs_company_status');
      table.dropIndex(['job_category_id', 'status'], 'idx_jobs_category_status');
      table.dropIndex(['status', 'featured', 'deadline'], 'idx_jobs_active_featured');
    });
  }

  if (await knex.schema.hasTable('candidates')) {
    await knex.schema.alterTable('candidates', (table) => {
      table.dropIndex(['user_id', 'status'], 'idx_candidates_user_status');
      table.dropIndex(['profession_id', 'status'], 'idx_candidates_profession');
    });
  }

  if (await knex.schema.hasTable('job_bookmarks')) {
    await knex.schema.alterTable('job_bookmarks', (table) => {
      table.dropIndex(['candidate_id', 'job_id'], 'idx_bookmarks_candidate_job');
    });
  }
};
