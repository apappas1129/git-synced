import { exec } from 'child_process';

import { blue, blueBright, bold, dim, gray, green, italic, red, yellow } from 'yoctocolors';
import yoctoSpinner from 'yocto-spinner';

import { spinnerOptions } from './spinner.js';

export function runCommitScript() {
  return new Promise((resolve) => {
    const spinner = yoctoSpinner({ text: 'Running ' + blue('bash script.sh'), ...spinnerOptions }).start();

    exec('bash script.sh', (error, stdout, stderr) => {
      if (error) {
        spinner.stop();
        console.error(red('✘ Execution error:'), error);
        process.exit(1);
      }
      console.log(dim(stdout));
      if (stderr) console.log(stderr);

      spinner.stop();
      console.log('Process terminated without errors.');
      console.log(green('✔ Success! All commits have been made locally.'));
      console.log('You may review the commits and, when ready, run ' + blue('git push'));
      console.log('\n' + bold(blueBright('Why are my contributions not showing up on my profile?\n')));
      console.log(`After making a commit that meets the requirements to count as a contribution, you may need to ${yellow(bold('wait for up to 24 hours'))} to see the contribution appear on your contributions graph.`);
      console.log('Please refer to GitHub Docs: ' + bold(yellow('Contributions that are counted')));
      console.log(italic(gray('https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/why-are-my-contributions-not-showing-up-on-my-profile#contributions-that-are-counted')));
      resolve();
    });
  });
}
