// Auto-generated from 2025_11_17_000001_create_profiles_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('profiles'))) {
    await knex.schema.createTable('profiles', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.enu('persona_type', ['personal', 'professional', 'creator', 'business', 'anonymous', 'mentor']).defaultTo('personal');
      table.string('display_name').notNullable();
      table.string('handle').notNullable().unique();
      table.text('bio').nullable();
      table.string('avatar_path').nullable();
      table.string('cover_path').nullable();
      table.string('pronouns').nullable();
      table.string('location').nullable();
      table.string('gender').nullable();
      table.enu('age_bracket', ['teen', 'adult', 'senior']).index();
      table.boolean('women_safety_mode').defaultTo(false);
      table.enu('privacy_level', ['public', 'followers', 'private']).defaultTo('public');
      table.enu('dm_policy', ['public', 'everyone', 'followers', 'connections_only', 'trusted', 'mentors_only', 'no_one']).defaultTo('everyone');
      table.enu('tag_policy', ['public', 'everyone', 'followers', 'connections_only', 'trusted', 'mentors_only', 'no_one']).defaultTo('everyone');
      table.enu('mention_policy', ['public', 'everyone', 'followers', 'connections_only', 'trusted', 'mentors_only', 'no_one']).defaultTo('everyone');
      table.enu('location_visibility', ['public', 'followers', 'trusted_contacts', 'hidden']).defaultTo('public');
      table.json('goals').nullable();
      table.json('interests').nullable();
      table.json('skills').nullable();
      table.json('health_interests').nullable();
      table.json('safety_overrides').nullable();
      table.boolean('is_primary').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('last_safety_mode_applied_at').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['user_id', 'persona_type']);
      table.index('privacy_level');
      table.index('women_safety_mode');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('profiles');
};
