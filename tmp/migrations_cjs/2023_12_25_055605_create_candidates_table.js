// Auto-generated from 2023_12_25_055605_create_candidates_table.php
exports.up = function(knex) {
  return knex.schema.createTable('candidates', function(table) {
    table.bigIncrements('id');
    table.bigInteger('user_id').unsigned().notNullable();
    table.foreign('user_id').references('id').inTable('users');
    table.bigInteger('experience_id').unsigned().nullable();
    table.bigInteger('profession_id').unsigned().nullable();
    table.string('title').nullable();
    table.string('image').nullable();
    table.string('full_name').nullable();
    table.string('slug').nullable();
    table.enu('gender', ['male','female']).nullable();
    table.text('website').nullable();
    table.string('phone_one').nullable();
    table.string('phone_two').nullable();
    table.string('email').nullable();
    table.text('cv').nullable();
    table.text('bio').nullable();
    table.enu('marital_status', ['married','single']).nullable();
    table.date('birth_date').nullable();
    table.string('address').nullable();
    table.bigInteger('city').unsigned().nullable();
    table.bigInteger('state').unsigned().nullable();
    table.bigInteger('country').unsigned().nullable();
    table.enu('status', ['available', 'not_available']).nullable();
    table.boolean('profile_complete').defaultTo(false);
    table.boolean('visibility').defaultTo(false);
    table.timestamps(true, true);
    // Optional foreign keys
    table.foreign('experience_id').references('id').inTable('experiences');
    table.foreign('profession_id').references('id').inTable('professions');
    table.foreign('city').references('id').inTable('cities');
    table.foreign('state').references('id').inTable('states');
    table.foreign('country').references('id').inTable('countries');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('candidates');
};
