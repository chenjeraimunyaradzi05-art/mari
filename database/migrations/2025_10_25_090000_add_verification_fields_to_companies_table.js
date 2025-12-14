// Auto-generated from 2025_10_25_090000_add_verification_fields_to_companies_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('companies', 'abn');
  const __has_col_up_1 = await knex.schema.hasColumn('companies', 'asic_number');
  const __has_col_up_2 = await knex.schema.hasColumn('companies', 'domain');
  const __has_col_up_3 = await knex.schema.hasColumn('companies', 'verification_status');
  const __has_col_up_4 = await knex.schema.hasColumn('companies', 'verification_submitted_at');
  const __has_col_up_5 = await knex.schema.hasColumn('companies', 'verified_at');
  const __has_col_up_6 = await knex.schema.hasColumn('companies', 'verification_admin_id');
  const __has_col_up_7 = await knex.schema.hasColumn('companies', 'verification_notes');
  const __has_col_up_8 = await knex.schema.hasColumn('companies', 'verification_payload');
  const __has_col_up_9 = await knex.schema.hasColumn('companies', 'verification_source');

  const __has_col_up_0 = __has_col_up_0;
  const __has_col_up_1 = __has_col_up_1;
  const __has_col_up_2 = __has_col_up_2;
  const __has_col_up_3 = __has_col_up_3;
  const __has_col_up_4 = __has_col_up_4;
  const __has_col_up_5 = __has_col_up_5;
  const __has_col_up_6 = __has_col_up_6;
  const __has_col_up_7 = __has_col_up_7;
  const __has_col_up_8 = __has_col_up_8;
  const __has_col_up_9 = __has_col_up_9;

  if (await knex.schema.hasTable('companies')) {
    const hasAbn = __has_col_up_0;
    const hasAsic = __has_col_up_1;
    const hasDomain = __has_col_up_2;
    const hasVerificationStatus = __has_col_up_3;
    const hasSubmittedAt = __has_col_up_4;
    const hasVerifiedAt = __has_col_up_5;
    const hasAdminId = __has_col_up_6;
    const hasNotes = __has_col_up_7;
    const hasPayload = __has_col_up_8;
    const hasSource = __has_col_up_9;

    await knex.schema.alterTable('companies', (table) => {
      if (!hasAbn) {
        table.string('abn', 20).nullable().after('phone');
        table.unique('abn', 'companies_abn_unique');
      }
      if (!hasAsic) {
        table.string('asic_number', 20).nullable().after('abn');
      }
      if (!hasDomain) {
        table.string('domain').nullable().after('website');
        table.index('domain', 'companies_domain_index');
      }
      if (!hasVerificationStatus) {
        table.string('verification_status', 50).notNullable().defaultTo('pending').after('vision');
      }
      if (!hasSubmittedAt) {
        table.timestamp('verification_submitted_at').nullable().after('verification_status');
      }
      if (!hasVerifiedAt) {
        table.timestamp('verified_at').nullable().after('verification_submitted_at');
      }
      if (!hasAdminId) {
        table.bigInteger('verification_admin_id').unsigned().nullable().after('verified_at');
      }
      if (!hasNotes) {
        table.text('verification_notes').nullable().after('verification_admin_id');
      }
      if (!hasPayload) {
        table.json('verification_payload').nullable().after('verification_notes');
      }
      if (!hasSource) {
        table.string('verification_source', 50).notNullable().defaultTo('dashboard').after('verification_payload');
      }
    });

    // Add FK separately to avoid issues if admins table doesn't exist
    if (!hasAdminId) {
      await knex.schema.alterTable('companies', (table) => {
        table.foreign('verification_admin_id').references('id').inTable('admins').onDelete('SET NULL');
      });
    }
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('companies')) {
    await knex.schema.alterTable('companies', (table) => {
      if (table.hasOwnProperty) { }
    });
    // Reverse operations safely by checking column existence
    const hasSource = __has_col_up_9;
    const hasPayload = __has_col_up_8;
    const hasNotes = __has_col_up_7;
    const hasAdminId = __has_col_up_6;
    const hasVerifiedAt = __has_col_up_5;
    const hasSubmittedAt = __has_col_up_4;
    const hasVerificationStatus = __has_col_up_3;
    const hasDomain = __has_col_up_2;
    const hasAsic = __has_col_up_1;
    const hasAbn = __has_col_up_0;

    await knex.schema.alterTable('companies', (table) => {
      if (hasSource) table.dropColumn('verification_source');
      if (hasPayload) table.dropColumn('verification_payload');
      if (hasNotes) table.dropColumn('verification_notes');
      // Drop foreign key then column for verification_admin_id
      if (hasAdminId) {
        try { table.dropForeign(['verification_admin_id']); } catch (e) {}
        table.dropColumn('verification_admin_id');
      }
      if (hasVerifiedAt) table.dropColumn('verified_at');
      if (hasSubmittedAt) table.dropColumn('verification_submitted_at');
      if (hasVerificationStatus) table.dropColumn('verification_status');
      if (hasDomain) {
        try { table.dropIndex('domain', 'companies_domain_index'); } catch (e) {}
        table.dropColumn('domain');
      }
      if (hasAsic) table.dropColumn('asic_number');
      if (hasAbn) {
        try { table.dropUnique('companies_abn_unique'); } catch (e) {}
        table.dropColumn('abn');
      }
    });
  }
};
