// Auto-generated from 2024_11_mortgage_property_shares.php
exports.up = function(knex) {
  return knex.schema.createTable('property_mortgage_shares', function(table) {
    table.bigIncrements('id');
    table.bigInteger('property_social_post_id').unsigned().comment('FK to property_social_posts');
    table.bigInteger('property_id').unsigned().comment('FK to properties');
    table.bigInteger('user_id').unsigned().comment('FK to users - who shared it');
    table.enu('mortgage_perspective', ['buyer','investor','realtor']).defaultTo('buyer');
    table.decimal('loan_amount', 15, 2);
    table.decimal('monthly_payment', 10, 2);
    table.decimal('readiness_score', 5, 1);
    table.decimal('ltv', 5, 2);
    table.timestamps(true, true);
    table.index('mortgage_perspective');
    table.index(['property_id', 'created_at']);
    table.index(['user_id', 'created_at']);
    table.index('property_social_post_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('property_mortgage_shares');
};
