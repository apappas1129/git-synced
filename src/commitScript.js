import { execFileSync, execSync } from 'child_process';
import { promises as fs } from 'fs';

import { dim, green, red } from 'yoctocolors';

import { promptContinueDespiteSkips } from './prompts.js';

// Wraps a value in single quotes for safe interpolation into script.sh, escaping any
// embedded single quotes (the only character that needs escaping inside '...' in sh).
function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function ensureGitRepository() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  } catch {
    console.error(red('✘ Error: This directory is not a git repository.'));
    console.error('cd into the repository whose contributions you want to sync, then run git-synced again.');
    process.exit(1);
  }
}

export async function writeScript(commits, committerName, committerEmail, commitMessage, spin) {
  let scriptContent = '';
  let hasCommits = false;
  let consecutiveSkips = 0;
  let countSkips = true;

  try {
    execSync('git rev-parse --verify HEAD');
    hasCommits = true;
  } catch (error) {
    if (!error.message.includes('fatal: Needed a single revision')) {
      return Promise.reject(error);
    }
  }

  // Change to a for...of loop to handle asynchronous operations properly
  for (const [date, commitCount] of commits) {
    for (let i = 0; i < commitCount; i++) {
      const message = commitMessage
        .replace('{{date}}', date)
        .replace('{{count}}', i + 1);

      let existingCommit;

      if (hasCommits) {
        existingCommit = execFileSync('git', ['log', `--grep=${message}`], { encoding: 'utf-8' }).trim();
      }

      if (!existingCommit) {
        consecutiveSkips = 0; // Reset the skip counter if a new commit is created
        const commitCommand =
          [
            `GIT_COMMITTER_NAME=${shellEscape(committerName)}`,
            `GIT_COMMITTER_EMAIL=${shellEscape(committerEmail)}`,
            `GIT_COMMITTER_DATE=${shellEscape(`${date}T00:00:00.000Z`)}`,
            `git commit`,
            `--allow-empty`,
            `-m ${shellEscape(message)}`,
            `--date=${shellEscape(`${date}T00:00:00.000Z`)}`,
            `--author=${shellEscape(`${committerName} <${committerEmail}>`)}`,
          ].join(' ') + '\n';

        scriptContent += commitCommand;
      } else {
        spin.clear();
        console.log(dim('\nSkipping commit that already exists\n'), dim(existingCommit));
        consecutiveSkips++;

        if (countSkips && consecutiveSkips > 20) {
          spin.stop();
          const answer = await promptContinueDespiteSkips();

          if (answer) {
            countSkips = false;
            spin.start();
          } else {
            console.log('Operation cancelled.');
            process.exit(0);
          }
        }
      }
    }
  }

  if (scriptContent) {
    await fs.writeFile('script.sh', scriptContent, { encoding: 'utf8' });
    console.log(green(`✔ Success! script.sh has been generated with ${scriptContent.split('\n').length} commits.`));
    return Promise.resolve();
  } else {
    return Promise.reject(new Error('No commits were generated.'));
  }
}
