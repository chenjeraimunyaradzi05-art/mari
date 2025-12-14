// Auto-generated from 2025_11_15_104500_rename_comment_column_on_social_comments.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('social_comments', 'content');
  if (!(await knex.schema.hasTable('social_comments'))) {
    return;
  }
  if (__has_col_up_0) {
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
  if (!(__has_col_up_0)) {
    return;
  }
  await knex.schema.alterTable('social_comments', (table) => {
    table.renameColumn('content', 'comment');
  });
};
