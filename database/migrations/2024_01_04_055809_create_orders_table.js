// Auto-generated from 2024_01_04_055809_create_orders_table.php
exports.up = function(knex) {
  return knex.schema.createTable('orders', function(table) {
    table.bigIncrements('id');
    table.bigInteger('company_id').unsigned().notNullable();
    table.bigInteger('plan_id').unsigned().notNullable();
    table.string('package_name');
    table.string('transaction_id');
    table.string('order_id');
    table.string('payment_provider');
    table.double('amount');
    table.string('paid_in_currency');
    table.string('default_amount');
    table.enu('payment_status', ['paid', 'unpaid']);
    table.timestamps(true, true);
    table.foreign('company_id').references('id').inTable('companies');
    table.foreign('plan_id').references('id').inTable('plans');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('orders');
};
