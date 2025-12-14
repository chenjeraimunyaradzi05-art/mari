// Auto-generated from 2025_11_17_120000_add_verification_fields_to_social_profiles_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('social_profiles', 'verification_status');
  const __has_col_up_1 = await knex.schema.hasColumn('social_profiles', 'verification_submitted_at');
  const __has_col_up_2 = await knex.schema.hasColumn('social_profiles', 'verification_reviewed_at');
  const __has_col_up_3 = await knex.schema.hasColumn('social_profiles', 'verification_reviewer_id');
  const __has_col_up_4 = await knex.schema.hasColumn('social_profiles', 'verification_notes');
  if (await knex.schema.hasTable('social_profiles')) {
    if (!__has_col_up_0) {
      await knex.schema.alterTable('social_profiles', (table) => {
        table.string('verification_status').defaultTo('unverified').after('is_verified');
      });
    }

    if (!__has_col_up_1) {
      await knex.schema.alterTable('social_profiles', (table) => {
        table.timestamp('verification_submitted_at').nullable().after('verification_status');
      });
    }

    if (!__has_col_up_2) {
      await knex.schema.alterTable('social_profiles', (table) => {
        table.timestamp('verification_reviewed_at').nullable().after('verification_submitted_at');
      });
    }

    if (!__has_col_up_3) {
      await knex.schema.alterTable('social_profiles', (table) => {
        table.bigInteger('verification_reviewer_id').unsigned().nullable().after('verification_reviewed_at');
        table.foreign('verification_reviewer_id').references('admins.id').onDelete('SET NULL');
      });
    }

    if (!__has_col_up_4) {
      await knex.schema.alterTable('social_profiles', (table) => {
        table.text('verification_notes').nullable().after('verification_reviewer_id');
      });
    }

    // Add index
    await knex.schema.alterTable('social_profiles', (table) => {
      table.index('verification_status');
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('social_profiles')) {
    if (__has_col_up_0) {
      await knex.schema.alterTable('social_profiles', (table) => { table.dropColumn('verification_status'); });
    }

    if (__has_col_up_1) {
      await knex.schema.alterTable('social_profiles', (table) => { table.dropColumn('verification_submitted_at'); });
    }

    if (__has_col_up_2) {
      await knex.schema.alterTable('social_profiles', (table) => { table.dropColumn('verification_reviewed_at'); });
    }

    if (__has_col_up_3) {
      await knex.schema.alterTable('social_profiles', (table) => { table.dropForeign(['verification_reviewer_id']); table.dropColumn('verification_reviewer_id'); });
    }

    if (__has_col_up_4) {
      await knex.schema.alterTable('social_profiles', (table) => { table.dropColumn('verification_notes'); });
    }
  }
};
