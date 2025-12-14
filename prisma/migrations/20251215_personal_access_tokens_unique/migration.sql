-- Remove duplicate rows (keep lowest id per tokenable_id+token), then add composite unique index on (id, token)
DELETE FROM personal_access_tokens
WHERE id NOT IN (
  SELECT MIN(id) FROM personal_access_tokens GROUP BY tokenable_id, token
);

-- Add composite unique index on (id, token) for extra safety
CREATE UNIQUE INDEX IF NOT EXISTS personal_access_tokens_id_token_unique ON personal_access_tokens (id, token);
