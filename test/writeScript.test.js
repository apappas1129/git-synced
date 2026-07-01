import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { writeScript } from '../src/commitScript.js';

function noopSpinner() {
  return { clear() {}, start() {}, stop() {} };
}

test('writeScript generates commits for a fresh repo, then skips them all on a second identical pass', async () => {
  const originalCwd = process.cwd();
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'git-synced-writescript-'));
  process.chdir(tmpDir);

  try {
    execSync('git init', { stdio: 'ignore' });

    const commitMessage = ':green_square: {{date}} commit {{count}}';
    const commits = new Map([
      ['2024-02-01', 2],
      ['2024-02-02', 1],
    ]);

    await writeScript(commits, 'Test User', 'test@example.com', commitMessage, noopSpinner());
    execSync('bash script.sh', { stdio: 'ignore' });

    const log = execSync("git log --format='%an|%ae|%ad|%s' --date=short", {
      encoding: 'utf8',
      env: { ...process.env, TZ: 'UTC' },
    }).trim().split('\n');

    assert.equal(log.length, 3);
    for (const line of log) {
      const [name, email, date] = line.split('|');
      assert.equal(name, 'Test User');
      assert.equal(email, 'test@example.com');
      assert.match(date, /^2024-02-0[12]$/);
    }

    // Second pass with identical commits: everything should be detected as
    // already existing (via `git log --grep`), so no new commits are made.
    const commitsAgain = new Map([
      ['2024-02-01', 2],
      ['2024-02-02', 1],
    ]);

    await assert.rejects(
      () => writeScript(commitsAgain, 'Test User', 'test@example.com', commitMessage, noopSpinner()),
      /No commits were generated/,
    );

    const logAfter = execSync('git log --oneline', { encoding: 'utf8' }).trim().split('\n');
    assert.equal(logAfter.length, 3, 'no new commits should have been added on the second pass');
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
