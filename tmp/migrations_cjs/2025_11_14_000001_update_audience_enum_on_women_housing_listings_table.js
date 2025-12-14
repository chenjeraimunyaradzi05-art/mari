// Auto-generated from 2025_11_14_000001_update_audience_enum_on_women_housing_listings_table.php
// Ported from Laravel migration to Knex up/down (MySQL-only)

exports.up = async function(knex) {
  const client = knex.client.config.client;
  if (!client || (client !== 'mysql' && client !== 'mysql2')) {
    return;
  }

  await knex.raw(`ALTER TABLE women_housing_listings MODIFY audience ENUM('women_only','women_students','women_professionals','women_caregivers','women_retirees') DEFAULT 'women_only'`);
};

exports.down = async function(knex) {
  const client = knex.client.config.client;
  if (!client || (client !== 'mysql' && client !== 'mysql2')) {
    return;
  }

  await knex.raw(`ALTER TABLE women_housing_listings MODIFY audience ENUM('women_only','women_students','women_professionals') DEFAULT 'women_only'`);
};
