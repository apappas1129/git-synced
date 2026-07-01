#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';

import { blue, red } from 'yoctocolors';
import yoctoSpinner from 'yocto-spinner';

import { parseArgs, printHelp, printVersion } from './src/cli.js';
import { printLogo } from './src/logo.js';
import { scrapeCommits } from './src/scraper.js';
import { ensureGitRepository, writeScript } from './src/commitScript.js';
import { runCommitScript } from './src/executeScript.js';
import { spinnerOptions } from './src/spinner.js';
import { validateHtmlFileName } from './src/validators.js';
import {
  promptFileName,
  promptCommitterName,
  promptCommitterEmail,
  promptCommitMessage,
  promptExecuteScript,
} from './src/prompts.js';

const args = parseArgs(process.argv);

if (args.help) {
  printHelp();
  process.exit(0);
}

if (args.version) {
  printVersion();
  process.exit(0);
}

printLogo();
ensureGitRepository();

let fileName = args.file;
if (fileName) {
  const validation = validateHtmlFileName(fileName);
  if (validation !== true) {
    console.error(red(`✘ Error: ${validation}`));
    process.exit(1);
  }
} else {
  fileName = await promptFileName();
}

const filePath = path.resolve(process.cwd(), fileName);

try {
  const page = await fs.readFile(filePath, 'utf8');

  if (page && page.length) {
    const lines = page.split('\n').length;
    console.log(`Successfully read file containing ${lines} lines.`);
  } else {
    console.error(red('✘ Error: The file is empty.'));
    process.exit(1);
  }

  console.log(blue('To ensure your commits are linked to your primary account, please input the following details:'));

  const committerName = await promptCommitterName();
  const committerEmail = await promptCommitterEmail();
  const commitMessage = await promptCommitMessage();

  const commits = scrapeCommits(page);
  const spin = yoctoSpinner({ text: 'Generating commits', ...spinnerOptions }).start();

  writeScript(commits, committerName, committerEmail, commitMessage, spin)
    .then(async () => {
      spin.stop();
      const execute = await promptExecuteScript();
      if (!execute) process.exit(0);

      await runCommitScript();
      process.exit(0);
    })
    .catch((error) => {
      spin.stop();
      console.error(red(`✘ Error: ${error.message}`));
      process.exit(1);
    });
} catch (error) {
  console.error(red(`✘ Error: ${error.message}`));
  process.exit(1);
}
