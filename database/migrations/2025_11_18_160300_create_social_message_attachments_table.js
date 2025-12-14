// Auto-generated from 2025_11_18_160300_create_social_message_attachments_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_message_attachments'))) {
    await knex.schema.createTable('social_message_attachments', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_message_id').unsigned().notNullable();
      table.foreign('social_message_id').references('social_messages.id').onDelete('CASCADE');
      table.bigInteger('uploaded_by_social_profile_id').unsigned().notNullable();
      table.foreign('uploaded_by_social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.string('media_type', 32).notNullable();
      table.string('storage_disk').nullable();
      table.string('file_path').notNullable();
      table.string('thumbnail_path').nullable();
      table.string('mime_type').nullable();
      table.bigInteger('file_size').unsigned().nullable();
      table.integer('width').nullable();
      table.integer('height').nullable();
      table.integer('duration').nullable();
      table.string('mediaable_type').nullable();
      table.bigInteger('mediaable_id').unsigned().nullable();
      table.json('meta').nullable();
      table.timestamps(true, true);

      table.index('mediaable_id');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_message_attachments');
};
