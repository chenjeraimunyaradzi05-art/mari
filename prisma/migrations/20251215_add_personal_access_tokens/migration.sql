-- Create personal_access_tokens if it does not exist (safe to run multiple times)
CREATE TABLE IF NOT EXISTS personal_access_tokens (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tokenable_id BIGINT NOT NULL,
  tokenable_type TEXT NOT NULL,
  name TEXT,
  token VARCHAR(64) NOT NULL UNIQUE,
  abilities TEXT NULL,
  last_used_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS personal_access_tokens_tokenable_type_tokenable_id_index ON personal_access_tokens (tokenable_type, tokenable_id);
CREATE INDEX IF NOT EXISTS personal_access_tokens_expires_at_index ON personal_access_tokens (expires_at);
