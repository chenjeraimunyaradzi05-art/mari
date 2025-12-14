// Auto-generated from 2025_11_18_160800_create_social_message_reactions_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_message_reactions'))) {
    await knex.schema.createTable('social_message_reactions', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_message_id').unsigned().notNullable();
      table.foreign('social_message_id').references('social_messages.id').onDelete('CASCADE');
      table.bigInteger('social_profile_id').unsigned().notNullable();
      table.foreign('social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.string('emoji', 32).notNullable();
      table.timestamps(true, true);

      table.unique(['social_message_id', 'social_profile_id', 'emoji'], 'sm_reactions_message_profile_emoji_unique');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_message_reactions');
};
