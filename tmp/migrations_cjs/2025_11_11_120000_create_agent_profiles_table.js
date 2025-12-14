// Auto-generated from 2025_11_11_120000_create_agent_profiles_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('agent_profiles'))) {
    await knex.schema.createTable('agent_profiles', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable().unique();
      table.bigInteger('social_profile_id').unsigned().nullable().unique();
      table.string('headline').nullable();
      table.text('bio').nullable();
      table.integer('experience_years').unsigned().notNullable().defaultTo(0);
      table.json('transaction_focus').nullable();
      table.json('service_regions').nullable();
      table.enu('availability_status', ['available', 'waitlist', 'offline']).notNullable().defaultTo('available');
      table.string('calendly_url').nullable();
      table.string('video_pitch_url').nullable();
      table.timestamps(true, true);

      table.index(['availability_status']);
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('social_profile_id').references('id').inTable('social_profiles').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('agent_profiles');
};
