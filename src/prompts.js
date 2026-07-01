import { confirm, input } from '@inquirer/prompts';

import { validateHtmlFileName } from './validators.js';

export function promptFileName() {
  return input({
    message: 'Enter the html file name with your GitHub profile page content.',
    default: 'index.html',
    validate: validateHtmlFileName,
  });
}

export function promptCommitterName() {
  return input({
    message: 'Committer name:',
    validate: (value) => !!value.trim().length || 'Committer name is required.',
  });
}

export function promptCommitterEmail() {
  return input({
    message: 'Committer email:',
    validate: (value) => {
      if (!value.trim()) return 'Committer email is required.';
      if (!value.match(/^\S+@\S+\.\S+$/)) return 'Invalid email format.';
      return true;
    },
  });
}

export function promptCommitMessage() {
  return input({
    message: 'Enter commit message format:',
    default: ':green_square: git-synced {{date}} commit {{count}}',
  });
}

export function promptExecuteScript() {
  return confirm({ message: 'Do you want to execute the script.sh file?', default: false });
}

export function promptContinueDespiteSkips() {
  return confirm({
    message: 'More than 20 consecutive commits have been skipped.\nAre you sure your HTML file has the correct content and want to continue?',
    default: false,
  });
}
