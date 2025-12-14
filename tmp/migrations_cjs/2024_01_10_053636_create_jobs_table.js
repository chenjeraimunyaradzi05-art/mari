// Auto-generated from 2024_01_10_053636_create_jobs_table.php
exports.up = function(knex) {
  return knex.schema.createTable('jobs', function(table) {
    table.bigIncrements('id');
    table.bigInteger('company_id').unsigned().notNullable();
    table.bigInteger('job_category_id').unsigned().notNullable();
    table.bigInteger('job_role_id').unsigned().notNullable();
    table.bigInteger('job_experience_id').unsigned().notNullable();
    table.bigInteger('education_id').unsigned().notNullable();
    table.bigInteger('job_type_id').unsigned().notNullable();
    table.bigInteger('salary_type_id').unsigned().notNullable();
    table.string('title');
    table.string('slug');
    table.string('vacancies');
    table.double('min_salary').nullable();
    table.double('max_salary').nullable();
    table.string('custom_salary').nullable();
    table.date('deadline');
    table.text('description');
    table.enu('status', ['pending', 'active', 'expired']).defaultTo('pending');
    table.enu('apply_on', ['app', 'email', 'custom_url']);
    table.string('apply_email').nullable();
    table.text('apply_url').nullable();
    table.boolean('featured').nullable();
    table.boolean('highlight').nullable();
    table.date('featured_until').nullable();
    table.date('highlight_until').nullable();
    table.integer('total_views').defaultTo(0);
    table.bigInteger('city_id').unsigned().nullable();
    table.bigInteger('state_id').unsigned().nullable();
    table.bigInteger('country_id').unsigned().nullable();
    table.string('address').nullable();
    table.enu('salary_mode', ['range', 'custom']);
    table.string('company_name').nullable();
    table.timestamps(true, true);

    table.foreign('company_id').references('id').inTable('companies');
    table.foreign('job_category_id').references('id').inTable('job_categories').onDelete('CASCADE');
    table.foreign('job_role_id').references('id').inTable('job_roles');
    table.foreign('job_experience_id').references('id').inTable('job_experiences');
    table.foreign('education_id').references('id').inTable('education');
    table.foreign('job_type_id').references('id').inTable('job_types');
    table.foreign('salary_type_id').references('id').inTable('salary_types');
    table.foreign('city_id').references('id').inTable('cities');
    table.foreign('state_id').references('id').inTable('states');
    table.foreign('country_id').references('id').inTable('countries');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('jobs');
};
