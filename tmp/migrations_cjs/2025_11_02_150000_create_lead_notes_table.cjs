// Auto-generated from 2025_11_02_150000_create_lead_notes_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('lead_notes'))) {
    await knex.schema.createTable('lead_notes', (table) => {
      table.bigIncrements('id');
      table.bigInteger('lead_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().notNullable();
      table.text('body').notNullable();
      table.timestamps(true, true);

      table.index(['lead_id', 'created_at']);
      table.foreign('lead_id').references('id').inTable('leads').onDelete('CASCADE');
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('lead_notes');
};
