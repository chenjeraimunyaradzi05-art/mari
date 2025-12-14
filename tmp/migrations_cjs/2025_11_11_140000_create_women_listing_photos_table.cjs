// Auto-generated from 2025_11_11_140000_create_women_listing_photos_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('women_listing_photos'))) {
    await knex.schema.createTable('women_listing_photos', (table) => {
      table.bigIncrements('id');
      table.bigInteger('women_housing_listing_id').unsigned().notNullable();
      table.foreign('women_housing_listing_id').references('women_housing_listings.id').onDelete('CASCADE');
      table.string('storage_path').notNullable();
      table.string('cdn_url').nullable();
      table.string('caption').nullable();
      table.smallint('position').unsigned().defaultTo(0);
      table.boolean('is_primary').defaultTo(false);
      table.json('meta').nullable();
      table.timestamps(true, true);

      table.index(['women_housing_listing_id', 'position']);
      table.index(['women_housing_listing_id', 'is_primary']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('women_listing_photos');
};
