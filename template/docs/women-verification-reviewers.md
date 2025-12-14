# Women Real Estate Verification Reviewers

To control who can access the WomenRise verification queue and audit export endpoints:

1. **Configure reviewer roles**
   Set `WOMEN_REAL_ESTATE_VERIFICATION_REVIEWER_ROLES` in your environment file. Multiple roles can be supplied as a comma-separated list (e.g. "Women Verification Reviewer,Compliance Lead"). Run `php artisan config:clear` after updating environment values so the gate picks up the changes.

2. **Assign roles to admin accounts**
   Use the provided Artisan command to assign the configured roles to authorised admins:

   ```bash
   php artisan women:verification:assign-reviewer admin1@example.com admin2@example.com
   ```

   The command automatically creates the configured roles (guard `admin`) if they do not already exist.

3. **Revoke access**
   Remove the reviewer role from an admin with standard Spatie Permission helpers, e.g.:

   ```php
   $admin->removeRole('Women Verification Reviewer');
   ```

Only admins with one of the configured reviewer roles (or Super Admins) can reach the WomenRise verification queue, export audits, review analytics, download regulator reports, or authorise compliance actions.

## Compliance Tooling

- **Encryption audit:** run `php artisan women:verification:encryption-check` to scan for legacy plaintext payloads or audit notes. Append `--fix` to automatically re-encrypt any records created before encrypted casts were enabled.
- **Regulator reporting:** Reviewer admins can download regulator-facing workbooks from the queue header (`Regulator Report` button) or via the route `admin.women.verification.regulator-report`. Optional query parameters (`regulator`, `status`, `from`, `to`) narrow the export, and the file includes both a per-regulator summary sheet and detailed agent listings.
