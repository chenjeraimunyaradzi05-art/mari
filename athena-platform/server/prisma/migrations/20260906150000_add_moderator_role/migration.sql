-- A role between member and admin: moderators work the report queue, content
-- moderation and appeals without holding the keys to users, billing and settings.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MODERATOR';
