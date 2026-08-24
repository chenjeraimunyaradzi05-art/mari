-- Read watermark for channel members, so unread counts and "mark as read" have
-- somewhere to live. NULL means the member has never opened the channel.
--
-- Hand-written rather than generated from the live datasource: that database
-- carries tables this schema does not model, so a generated diff drops them.
-- See docs/runbooks/SHARED-DATABASE-HAZARD.md.

-- AlterTable
ALTER TABLE "ChannelMember" ADD COLUMN "lastReadAt" TIMESTAMP(3);
