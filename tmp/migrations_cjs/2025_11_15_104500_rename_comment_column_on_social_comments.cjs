// Auto-generated from 2025_11_15_104500_rename_comment_column_on_social_comments.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_comments'))) {
    return;
  }
  if (await knex.schema.hasColumn('social_comments', 'content')) {
    return;
  }
  await knex.schema.alterTable('social_comments', (table) => {
    table.renameColumn('comment', 'content');
  });
};

exports.down = async function(knex) {
  if (!(await knex.schema.hasTable('social_comments'))) {
    return;
  }
  if (!(await knex.schema.hasColumn('social_comments', 'content'))) {
    return;
  }
  await knex.schema.alterTable('social_comments', (table) => {
    table.renameColumn('content', 'comment');
  });
};
