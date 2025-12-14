// Auto-generated from 2025_11_11_101000_create_listing_photos_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('listing_photos'))) {
    await knex.schema.createTable('listing_photos', (table) => {
      table.bigIncrements('id');
      table.bigInteger('housing_listing_id').unsigned().notNullable();
      table.string('storage_path').notNullable();
      table.string('cdn_url').nullable();
      table.string('caption').nullable();
      table.smallint('position').unsigned().notNullable().defaultTo(0);
      table.boolean('is_primary').notNullable().defaultTo(false);
      table.json('meta').nullable();
      table.timestamps(true, true);

      table.index(['housing_listing_id', 'position']);
      table.index(['housing_listing_id', 'is_primary']);
      table.foreign('housing_listing_id').references('id').inTable('housing_listings').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('listing_photos');
};
