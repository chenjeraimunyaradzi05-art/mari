-- A repost notifies the original author like a like or a comment does.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REPOST';
