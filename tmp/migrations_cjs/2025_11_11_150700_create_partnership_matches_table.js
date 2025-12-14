// Auto-generated from 2025_11_11_150700_create_partnership_matches_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('partnership_matches'))) {
    await knex.schema.createTable('partnership_matches', (table) => {
      table.bigIncrements('id');
      table.bigInteger('listing_partnership_intention_id').unsigned().notNullable();
      table.foreign('listing_partnership_intention_id').references('listing_partnership_intentions.id').onDelete('CASCADE');
      table.bigInteger('counterparty_user_id').unsigned().notNullable();
      table.foreign('counterparty_user_id').references('users.id').onDelete('CASCADE');
      table.decimal('match_score', 5, 2).nullable();
      table.text('ai_explanation').nullable();
      table.enu('status', ['requested', 'accepted', 'declined']).defaultTo('requested');
      table.enu('action_required_by', ['initiator', 'counterparty']).nullable();
      table.timestamps(true, true);

      table.unique(['listing_partnership_intention_id', 'counterparty_user_id'], 'partnership_matches_unique_pair');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('partnership_matches');
};
