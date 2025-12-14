# Pronoun Language Guardrails

This project now enforces gender-inclusive wording using an Artisan command and automated CI checks. The pronoun lint scans common content sources (Blade views, language strings, JS/TS, Vue, JSON, and Markdown assets) for masculine-coded words that can alienate readers. Any violation fails the build so regressions are caught before shipping.

## Running the linter locally

```bash
composer install
php artisan pronoun:lint
```

Use the `--quiet-output` flag when you only care about the exit code, or omit it to see a table of every match with file, line number, and excerpt. For large refactors you can scope the scan to a specific directory:

```bash
php artisan pronoun:lint --path=resources/views/frontend/pages
```

## Command options

| Option | Description |
| --- | --- |
| `--path=*` | Limit the scan to one or more relative paths (defaults to key resource directories). |
| `--extensions=...` | Comma-separated list of file extensions to include. Defaults to `php,blade.php,js,ts,vue,json,md`. |
| `--allow=...` | Comma-separated list of words to ignore for this run (case-insensitive). Useful for legitimate nouns such as surnames. |
| `--quiet-output` | Suppress the detailed table and only print pass/fail markers. |

## Extending the allow-list

1. **Ad-hoc allowances** — When a false positive should be tolerated only for a single run, pass the term via `--allow="surname"`. Multiple entries can be comma separated.
2. **Persistent allowances** — When the word is broadly acceptable, open `app/Console/Commands/PronounLintCommand.php` and remove it from the `$defaultTerms` list or add context-specific guards directly in the content. Follow up with a short PR note so reviewers understand why it is safe.
3. **CI overrides** — If the workflow must permanently ignore a word, update `.github/workflows/ci-cd.yml` and append `--allow=word` to the "Run pronoun lint" step so the shared pipeline stays in sync with local expectations.

Before opening a pull request, always run `php artisan pronoun:lint` locally to catch issues early. The GitHub Action runs the same command on every push and pull request targeting `main` or `develop`, so discrepancies will fail the build.
