import { createRequire } from 'module';

// Relative to this module file, not cwd -- correct for reading our own package.json
// regardless of where the CLI is installed or invoked from.
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

export function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { help: false, version: false, file: null };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-v') {
      result.version = true;
    } else if (arg === '--file' || arg === '-f') {
      result.file = args[++i];
    } else if (arg.startsWith('--file=')) {
      result.file = arg.slice('--file='.length);
    }
  }

  return result;
}

export function printHelp() {
  console.log(`Usage: git-synced [options]

Generate empty commits that mirror the contribution graph from a secondary
GitHub profile, so those contributions also plot on your primary account.

Run this from inside the git repository you want the commits added to.

Options:
  -f, --file <path>   Path to the saved GitHub profile page HTML.
                      Skips the interactive file-name prompt.
  -v, --version       Print the version number.
  -h, --help          Show this help message.`);
}

export function printVersion() {
  console.log(pkg.version);
}
