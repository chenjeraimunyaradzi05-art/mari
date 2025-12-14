// Auto-generated from vendor/cviebrock tests 2015_08_17_185144_authors.php

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('authors'))) {
    await knex.schema.createTable('authors', (table) => {
      table.increments('id');
      table.string('name').notNullable();
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('authors');
};
