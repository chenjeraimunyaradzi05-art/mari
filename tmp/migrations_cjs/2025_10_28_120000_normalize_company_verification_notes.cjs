// Auto-generated from 2025_10_28_120000_normalize_company_verification_notes.php
// Ported from Laravel migration to Knex up/down
function normalizeNotes(notes) {
  if (notes === null || notes === undefined) return null;
  let trimmed = notes.toString().trim();
  // Normalize newlines to \n
  trimmed = trimmed.replace(/\r\n|\r/g, '\n');
  // Collapse multiple horizontal whitespace into single space
  trimmed = trimmed.replace(/\s{2,}/g, ' ');
  return trimmed;
}

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('companies'))) return;
  const rows = await knex('companies').select('id', 'verification_notes').whereNotNull('verification_notes');
  for (const row of rows) {
    const normalized = normalizeNotes(row.verification_notes);
    if (normalized !== row.verification_notes) {
      await knex('companies').where('id', row.id).update({ verification_notes: normalized });
    }
  }
};

exports.down = async function(knex) {
  // Normalization is non-destructive; nothing to revert
};
