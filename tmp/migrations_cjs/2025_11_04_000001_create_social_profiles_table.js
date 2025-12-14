// Auto-generated from 2025_11_04_000001_create_social_profiles_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_profiles')) return;
  await knex.schema.createTable('social_profiles', (table) => {
    table.bigIncrements('id');
    table.string('profileable_type');
    table.bigInteger('profileable_id').unsigned();
    table.string('username').notNullable().unique();
    table.string('display_name').notNullable();
    table.text('bio').nullable();
    table.string('avatar').nullable();
    table.string('cover_photo').nullable();
    table.string('website').nullable();
    table.json('social_links').nullable();
    table.enu('profile_type', ['candidate', 'education_provider', 'trainee', 'sole_trader', 'company', 'government']);
    table.boolean('is_verified').notNullable().defaultTo(false);
    table.boolean('is_private').notNullable().defaultTo(false);
    table.integer('followers_count').notNullable().defaultTo(0);
    table.integer('following_count').notNullable().defaultTo(0);
    table.integer('posts_count').notNullable().defaultTo(0);
    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();

    table.index(['profile_type', 'is_verified']);
  });

  // Add fulltext index for MySQL clients
  const client = (knex.client && (knex.client.config && knex.client.config.client)) || '';
  if (client && client.toString().startsWith('mysql')) {
    await knex.raw('ALTER TABLE social_profiles ADD FULLTEXT social_profiles_fulltext (username, display_name, bio)');
  }
};

exports.down = async function(knex) {
  const client = (knex.client && (knex.client.config && knex.client.config.client)) || '';
  if (client && client.toString().startsWith('mysql')) {
    // Drop fulltext index if it exists
    try {
      await knex.raw('ALTER TABLE social_profiles DROP INDEX social_profiles_fulltext');
    } catch (e) {
      // ignore
    }
  }
  await knex.schema.dropTableIfExists('social_profiles');
};
