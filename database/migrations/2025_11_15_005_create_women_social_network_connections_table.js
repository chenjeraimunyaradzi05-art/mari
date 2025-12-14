// Auto-generated from 2025_11_15_005_create_women_social_network_connections_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('women_social_network_connections'))) {
    await knex.schema.createTable('women_social_network_connections', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id_1').unsigned().notNullable();
      table.bigInteger('user_id_2').unsigned().notNullable();
      table.enu('connection_type', ['landlord_tenant','renter_renter','buyer_agent','connected']).defaultTo('connected');
      table.enu('status', ['pending','connected','blocked','rejected']).defaultTo('pending');
      table.text('message').nullable();
      table.timestamp('connected_at').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.foreign('user_id_1').references('users.id').onDelete('CASCADE');
      table.foreign('user_id_2').references('users.id').onDelete('CASCADE');
      table.unique(['user_id_1', 'user_id_2']);
      table.index('status');
      table.index('connection_type');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('women_social_network_connections');
};
