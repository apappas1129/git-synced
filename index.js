import { exec, execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { load } from 'cheerio';
import { confirm, input } from '@inquirer/prompts';
import { blue, blueBright, bold, dim, gray, green, greenBright, italic, red, yellow  } from 'yoctocolors';
import yoctoSpinner from 'yocto-spinner';

// Get the __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const spinnerOptions = {
  color: 'yellow',
  spinner: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] }
}

printLogo();

const fileName = await input({
  message: 'Enter the html file name with your GitHub profile page content.',
  default: 'index.html',
    validate: (value) => {
      if (!value.trim()) return 'HTML file name is required.';
      if (!value.endsWith('.html')) return 'File name must end with ".html".';
      return true;
    },
});

const filePath = path.join(__dirname, fileName);

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

  const committerName = await input({
    message: 'Committer name:',
    validate: (value) => !!value.trim().length || 'Committer name is required.',
   });

  const committerEmail = await input({
    message: 'Committer email:',
    validate: (value) => {
      if (!value.trim()) return 'Committer email is required.';
      if (!value.match(/^\S+@\S+\.\S+$/)) return 'Invalid email format.';
      return true;
    }
  });

  const commitMessage = await input({
    message: 'Enter commit message format:',
    default: ':green_square: git-synced {{date}} commit {{count}}',
  });

  const commits = scrapeCommits(page);
  const spin = yoctoSpinner({ text: 'Generating commits', ...spinnerOptions }).start();

  writeScript(commits, committerName, committerEmail, commitMessage, spin)
    .then(async () => {
      spin.stop();
      const execute = await confirm({ message: 'Do you want to execute the script.sh file?', default: false });
      if (!execute) process.exit(0);

      const spinner = yoctoSpinner({ text: 'Running ' + blue('bash script.sh'), ...spinnerOptions }).start();

      exec('bash script.sh', (error, stdout, stderr) => {
        if (error) {
          console.error(red('✘ Execution error:'), error);
          process.exit(1);
        }
        console.log(dim(stdout));
        if (stderr) console.log(stderr);

        spinner.stop();
        console.log('Process terminated without errors.');
        console.log(green('✔ Success! All commits have been made locally.'));
        console.log('You may review the commits and, when ready, run '+ blue('git push'));
        console.log('\n' + bold(blueBright('Why are my contributions not showing up on my profile?\n')));
        console.log(`After making a commit that meets the requirements to count as a contribution, you may need to ${yellow(bold('wait for up to 24 hours'))} to see the contribution appear on your contributions graph.`)
        console.log('Please refer to GitHub Docs: ' + bold(yellow('Contributions that are counted')));
        console.log(italic(gray('https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/why-are-my-contributions-not-showing-up-on-my-profile#contributions-that-are-counted')));
        process.exit(0);
      });
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

function scrapeCommits(page) {
  const commits = new Map();
  const $ = load(page);
  $('td[data-date]').each((_i, element) => {
    const date = $(element).attr('data-date');
    const level = parseInt($(element).attr('data-level'));

    if (date && level > 0) {
      const toolTipId = $(element).attr('id');
      const toolTipSelector = `tool-tip[for='${toolTipId}']`;
      const tooltipText = $(toolTipSelector).text().trim();

      const match = tooltipText.match(/(\d+) contribution/);
      const commitCount = match ? parseInt(match[1]) : 1;

      commits.set(date, commitCount);
    }
  });

  console.log(`${commits.size} days with contributions found.`);
  return commits;
}

async function writeScript(commits, committerName, committerEmail, commitMessage, spin) {
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
        existingCommit = execSync(`git log --grep="${message}"`, { encoding: 'utf-8' }).trim();
      }

      if (!existingCommit) {
        consecutiveSkips = 0; // Reset the skip counter if a new commit is created
        const commitCommand =
          [
            `GIT_COMMITTER_NAME='${committerName}'`,
            `GIT_COMMITTER_EMAIL='${committerEmail}'`,
            `GIT_COMMITTER_DATE='${date}T00:00:00.000Z'`,
            `git commit`,
            `--allow-empty`,
            `-m '${message}'`,
            `--date='${date}T00:00:00.000Z'`,
            `--author='${committerName} <${committerEmail}>'`,
          ].join(' ') + '\n';

        scriptContent += commitCommand;
      } else {
        spin.clear();
        console.log(dim('\nSkipping commit that already exists\n'), dim(existingCommit));
        consecutiveSkips++;

        if (countSkips && consecutiveSkips > 20) {
          spin.stop();
          const answer = await confirm({
            message: 'More than 20 consecutive commits have been skipped.\nAre you sure your HTML file has the correct content and want to continue?',
            default: false,
          });

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

function printLogo() {
  const logo = [
    '                                                 .',
    '                                               .o#',
    '                             .#######= %###% .o###oo',
    '                            ###\' `##\\  `###    ###',
    '                            ###   ###   ###    ###',
    '                            `##bod#Y\'   ###    ### .',
    '                            `#oooooo.  %###%   "###"',
    '                            d"     YD                      .o#',
    '                            "Y#####P\'                     "###',
    ' .====.# ====    === ===. .==.    .ooooo.   .ooooo.   .oooo###',
    'd##(  "#  `##.  .#\'  `###P"Y##b  d##\' `"Y# d##\' `##b d##\' `###',
    '`"Y##b.    `##..#\'    ###   ###  ###       ###ooo##Y ###   ###',
    '#.  )##b    `###\'     ###   ###  ###   .o# ###    .o ###   ###',
    '#""###P\'     .#\'     o###o o###o `Y#bod#P\' `Y#bod#P\' `Y#bod##P"',
    '         .o..P\'',
    '         `Y#P\'',
  ].map(line => {
     return line.split('').map(char => {
       if (char === '#') {
         // Randomly decide to color the `#` either dim or greenBright
         return Math.random() < 0.6 ? bold(green('#')) : dim(greenBright('#'));
       }
       return dim(green(char));
     }).join('');
   });

  logo.forEach(l => console.log(l));
  console.log('\n');
}