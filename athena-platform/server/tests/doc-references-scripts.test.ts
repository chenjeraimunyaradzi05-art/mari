/**
 * scripts/check-doc-references.js, the half that reads `npm run <script>`.
 *
 * DEPLOY.md told the operator to run `npm run db:seed` with the production
 * database URLs exported. The script had been split into db:seed:demo,
 * db:seed:real and others, so the command failed, and the root package.json
 * still forwarded to the old name. Nothing in a build reads a markdown file, so
 * the guard has to find a citation of a script that does not exist, in a
 * fenced block as well as in prose, and has to leave real ones alone.
 */

import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- a CommonJS script with no type declarations
const guard = require('../scripts/check-doc-references') as {
  npmScriptCitationsIn: (src: string) => Array<{ name: string; line: number }>;
};

const names = (src: string) => guard.npmScriptCitationsIn(src).map((citation) => citation.name);

describe('check-doc-references: npm scripts', () => {
  it('finds the command that prompted it, inside a fenced block', () => {
    const doc = ['### Seed Data', '```bash', '# From athena-platform/server', 'npm run db:seed', '```'].join('\n');
    expect(guard.npmScriptCitationsIn(doc)).toEqual([{ name: 'db:seed', line: 4 }]);
  });

  it('reads the namespaced names whole, not up to the first colon', () => {
    expect(names('Run `npm run db:seed:real` once, then `npm run db:seed:admin`.')).toEqual([
      'db:seed:real',
      'db:seed:admin',
    ]);
  });

  it('drops the sentence punctuation that ran into the name', () => {
    expect(names('Seed with npm run db:seed:real.')).toEqual(['db:seed:real']);
    expect(names('(npm run build)')).toEqual(['build']);
  });

  it('reads npm run-script and a flag before the name', () => {
    expect(names('npm run-script build')).toEqual(['build']);
    expect(names('npm run --silent check:env')).toEqual(['check:env']);
    expect(names('npm run -- --help')).toEqual([]);
  });

  it('does not take a placeholder or a bare command for a script', () => {
    expect(names('npm run <script>')).toEqual([]);
    expect(names('npm run')).toEqual([]);
    expect(names('npm install && npm test')).toEqual([]);
  });

  it('counts the line each citation is on', () => {
    const doc = 'first\n\nnpm run lint\nnpm run test\n';
    expect(guard.npmScriptCitationsIn(doc).map((citation) => citation.line)).toEqual([3, 4]);
  });
});

describe('the root package.json', () => {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const read = (relative: string) =>
    JSON.parse(fs.readFileSync(path.join(repoRoot, relative, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

  it('only forwards to scripts that the package it names defines', () => {
    const forwarded = Object.entries(read('.').scripts ?? {})
      .map(([script, command]) => {
        const match = command.match(/^cd (athena-platform\/[\w-]+) && npm run ([\w:.-]+)/);
        return match ? { script, dir: match[1], target: match[2] } : null;
      })
      .filter((entry): entry is { script: string; dir: string; target: string } => entry !== null);

    // A guard that finds nothing to check is not guarding anything.
    expect(forwarded.length).toBeGreaterThan(0);

    for (const { script, dir, target } of forwarded) {
      const defined = Object.keys(read(dir).scripts ?? {});
      // The message names the broken script, which is what somebody needs to read.
      expect({ script, target, defined: defined.includes(target) }).toEqual({ script, target, defined: true });
    }
  });
});
