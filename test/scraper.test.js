import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { scrapeCommits } from '../src/scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('scrapeCommits skips zero-level days and falls back to a count of 1 when no tooltip match is found', () => {
  const html = readFileSync(path.join(__dirname, 'fixtures', 'sample-profile.html'), 'utf8');
  const commits = scrapeCommits(html);

  assert.deepEqual(
    [...commits.entries()].sort(),
    [
      ['2024-01-01', 3],
      ['2024-01-03', 1],
      ['2024-01-04', 12],
      ['2024-01-05', 1],
    ].sort(),
  );
});

test('scrapeCommits against a real saved GitHub profile page (local-only, gitignored fixture)', (t) => {
  const realFixture = path.join(__dirname, '..', 'example source profile', 'alex-pappas-extel.html');

  if (!existsSync(realFixture)) {
    t.skip('example source profile/ fixture not present locally (gitignored, not part of the repo)');
    return;
  }

  const html = readFileSync(realFixture, 'utf8');
  const commits = scrapeCommits(html);

  assert.ok(commits.size > 0, 'expected at least one day with contributions in the real fixture');
});
