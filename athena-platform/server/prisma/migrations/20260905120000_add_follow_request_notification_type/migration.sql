-- Asking to follow someone who approves their followers is its own notification.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FOLLOW_REQUEST';
