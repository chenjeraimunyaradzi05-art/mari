// Auto-generated from 2025_10_24_000001_create_experiments_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('experiments'))) {
    await knex.schema.createTable('experiments', (table) => {
      table.bigIncrements('id');
      table.string('name').unique().notNullable();
      table.string('description').nullable();
      table.string('status').notNullable().defaultTo('active');
      table.json('variants').notNullable();
      table.json('weights').nullable();
      table.timestamp('started_at').nullable();
      table.timestamp('ended_at').nullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('experiment_assignments'))) {
    await knex.schema.createTable('experiment_assignments', (table) => {
      table.bigIncrements('id');
      table.bigInteger('experiment_id').unsigned().notNullable();
      table.string('visitor_id').index().notNullable();
      table.bigInteger('user_id').unsigned().nullable();
      table.string('variant').notNullable();
      table.timestamps(true, true);

      table.foreign('experiment_id').references('id').inTable('experiments').onDelete('CASCADE');
      table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
      table.unique(['experiment_id', 'visitor_id']);
    });
  }

  if (!(await knex.schema.hasTable('experiment_conversions'))) {
    await knex.schema.createTable('experiment_conversions', (table) => {
      table.bigIncrements('id');
      table.bigInteger('experiment_id').unsigned().notNullable();
      table.string('visitor_id').index().notNullable();
      table.bigInteger('user_id').unsigned().nullable();
      table.string('conversion_event').notNullable();
      table.json('metadata').nullable();
      table.timestamps(true, true);

      table.foreign('experiment_id').references('id').inTable('experiments').onDelete('CASCADE');
      table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('experiment_conversions');
  await knex.schema.dropTableIfExists('experiment_assignments');
  await knex.schema.dropTableIfExists('experiments');
};
