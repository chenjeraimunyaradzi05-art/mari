-- Recovery codes for two-factor authentication.
--
-- Until now the only second factor was the TOTP secret, so a lost or wiped
-- authenticator locked the account out permanently and the only way back in
-- was an operator editing the row by hand. This column holds bcrypt hashes of
-- single-use recovery codes; a code is deleted from the array as it is spent,
-- and the plaintext is shown to the user exactly once at enrolment.
--
-- Hand-written, additive, and non-destructive: no existing value changes.
-- Existing rows keep NULL, which Prisma reads as an empty list.
-- See docs/runbooks/SHARED-DATABASE-HAZARD.md.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "twoFactorRecoveryCodes" TEXT[];
