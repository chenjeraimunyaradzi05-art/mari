// Auto-generated from 2025_04_create_rental_social_networks_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('rental_social_networks');
  if (exists) return;

  await knex.schema.createTable('rental_social_networks', (table) => {
    table.bigIncrements('id');
    table.bigInteger('user_id_1').unsigned().notNullable().comment('FK to users - initiator');
    table.bigInteger('user_id_2').unsigned().notNullable().comment('FK to users - recipient');
    table.enu('connection_type', ['landlord_tenant', 'renter_renter', 'buyer_agent', 'connected']).notNullable().comment('Type of connection');
    table.enu('status', ['pending', 'connected', 'blocked', 'rejected']).notNullable().defaultTo('pending');
    table.text('message').nullable().comment('Initial connection message');
    table.timestamp('connected_at').nullable();
    table.timestamps(true, true);

    table.foreign('user_id_1').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('user_id_2').references('id').inTable('users').onDelete('CASCADE');

    table.unique(['user_id_1', 'user_id_2']);
    table.index('status');
    table.index('connection_type');
    table.index('connected_at');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('rental_social_networks');
};
