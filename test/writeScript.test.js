import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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

test('writeScript escapes committer values containing single quotes instead of injecting shell commands', async () => {
  const originalCwd = process.cwd();
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'git-synced-writescript-injection-'));
  process.chdir(tmpDir);

  try {
    execSync('git init', { stdio: 'ignore' });

    const maliciousName = `Alex'; touch injected.txt; echo done`;
    const commits = new Map([['2024-03-01', 1]]);

    await writeScript(commits, maliciousName, 'test@example.com', ':green_square: {{date}} commit {{count}}', noopSpinner());
    execSync('bash script.sh', { stdio: 'ignore' });

    assert.equal(existsSync(path.join(tmpDir, 'injected.txt')), false, 'malicious committer name must not execute as shell commands');

    const log = execSync("git log --format='%an'", { encoding: 'utf8' }).trim();
    assert.equal(log, maliciousName, 'committer name should round-trip intact, quote and all');
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
