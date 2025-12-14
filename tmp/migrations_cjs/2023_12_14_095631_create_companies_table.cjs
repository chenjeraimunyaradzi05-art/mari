// Auto-generated from 2023_12_14_095631_create_companies_table.php
exports.up = function(knex) {
  return knex.schema.createTable('companies', function(table) {
    table.bigIncrements('id');
    table.bigInteger('user_id').unsigned().notNullable();
    table.foreign('user_id').references('id').inTable('users');
    table.string('name').nullable();
    table.string('slug').nullable();
    table.bigInteger('industry_type_id').unsigned().nullable();
    table.bigInteger('organization_type_id').unsigned().nullable();
    table.bigInteger('team_size_id').unsigned().nullable();
    table.string('logo').nullable();
    table.string('banner').nullable();
    table.date('establishment_date').nullable();
    table.string('website').nullable();
    table.string('phone').nullable();
    table.string('email').nullable();
    table.text('bio').nullable();
    table.text('vision').nullable();
    table.integer('total_views').defaultTo(0);
    table.string('address').nullable();
    table.bigInteger('city').unsigned().nullable();
    table.bigInteger('state').unsigned().nullable();
    table.bigInteger('country').unsigned().nullable();
    table.text('map_link').nullable();
    table.boolean('is_profile_verified').defaultTo(false);
    table.timestamp('document_verified_at').nullable();
    table.boolean('profile_completion').defaultTo(false);
    table.boolean('visibility').defaultTo(false);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('companies');
};
