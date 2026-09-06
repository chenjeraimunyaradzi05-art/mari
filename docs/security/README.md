# ATHENA Security & Governance Documentation

_Created 2026-08-18 to close the documentation gates mandated by
`ATHENA_CODEX_AUDIT_AND_ROADMAP.md` §15.5. Each document states what is true
today; sections marked **[FOUNDER]** need a decision or fact only the founder
can supply. Review cadence: quarterly, or after any material change._

| Document | Purpose |
|---|---|
| [threat-model.md](threat-model.md) | What we protect, from whom, and how |
| [authorisation-matrix.md](authorisation-matrix.md) | Who may do what, per role and resource |
| [incident-response.md](incident-response.md) | What we do when something goes wrong |
| [data-inventory.md](data-inventory.md) | What personal data we hold and where |
| [retention-and-deletion.md](retention-and-deletion.md) | How long data lives and how it dies |
| [trust-claims-register.md](trust-claims-register.md) | Every public claim, with its evidence status |
| [repository-inventory.md](repository-inventory.md) | Every code line in this workspace and its status |
| [privacy-impact-assessment.md](privacy-impact-assessment.md) | Privacy risks and mitigations |
| [ai-system-card.md](ai-system-card.md) | AI features, their data, limits, and safeguards |

Related: `/SECURITY.md` (disclosure policy), `athena-platform/client/public/.well-known/security.txt`
(machine-readable disclosure), the gap report kept untracked at the repository root (evidence audit),
`/SECURITY-HARDENING-CHANGELOG.md` (applied fixes), `docs/security/templates/pir-template.md` (post-incident review).
