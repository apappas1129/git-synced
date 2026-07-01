import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { runCli } from './helpers/spawnCli.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, 'fixtures', 'sample-profile.html');

function makeTempGitRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), 'git-synced-e2e-'));
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  return dir;
}

test('--help prints usage and exits 0 without touching git', async () => {
  const { code, stdout } = await runCli({ cwd: tmpdir(), args: ['--help'] });
  assert.equal(code, 0);
  assert.match(stdout, /Usage: git-synced/);
});

test('--version prints the package version and exits 0', async () => {
  const { code, stdout } = await runCli({ cwd: tmpdir(), args: ['--version'] });
  assert.equal(code, 0);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('running outside a git repository fails fast with a clear error, before any prompts', async () => {
  const nonGitDir = mkdtempSync(path.join(tmpdir(), 'git-synced-nongit-'));
  try {
    const { code, stdout, stderr } = await runCli({
      cwd: nonGitDir,
      args: ['--file', fixturePath],
      inputs: [],
    });
    assert.equal(code, 1);
    assert.match(stdout + stderr, /not a git repository/);
  } finally {
    rmSync(nonGitDir, { recursive: true, force: true });
  }
});

test('full flow with --file: declining execution leaves script.sh on disk with no commits made', async () => {
  const repo = makeTempGitRepo();
  try {
    const { code, stdout } = await runCli({
      cwd: repo,
      args: ['--file', fixturePath],
      inputs: ['Test User', 'test@example.com', '', 'n'],
    });

    assert.equal(code, 0);
    assert.match(stdout, /script\.sh has been generated/);
    assert.ok(existsSync(path.join(repo, 'script.sh')));

    assert.throws(() => execSync('git rev-parse --verify HEAD', { cwd: repo, stdio: 'pipe' }));
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('full flow with --file: accepting execution creates the expected empty commits', async () => {
  const repo = makeTempGitRepo();
  try {
    const { code, stdout } = await runCli({
      cwd: repo,
      args: ['--file', fixturePath],
      inputs: ['Test User', 'test@example.com', '', 'y'],
    });

    assert.equal(code, 0);
    assert.match(stdout, /All commits have been made locally/);

    // fixture has 3 + 1 + 12 + 1 = 17 contribution-days worth of commits
    const log = execSync("git log --format='%an|%ae|%s'", { cwd: repo, encoding: 'utf8' }).trim().split('\n');
    assert.equal(log.length, 17);
    for (const line of log) {
      const [name, email] = line.split('|');
      assert.equal(name, 'Test User');
      assert.equal(email, 'test@example.com');
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
