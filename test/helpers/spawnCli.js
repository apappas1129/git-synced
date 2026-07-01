import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.js');

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b/g, '');
}

// Drives the real CLI as a child process, writing scripted answers to stdin
// with a delay between each so @inquirer/prompts has time to render/consume
// each one. Keeps stdin open (never calls .end()) -- the child exits itself
// via process.exit(), and closing stdin early causes @inquirer/prompts to
// treat later prompts as force-closed even with buffered input pending.
export function runCli({ cwd, args = [], inputs = [], stepDelayMs = 250 }) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [cliPath, ...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);

    (async () => {
      for (const line of inputs) {
        await new Promise((r) => setTimeout(r, stepDelayMs));
        child.stdin.write(line.endsWith('\n') ? line : `${line}\n`);
      }
    })();

    child.on('exit', (code) => {
      resolve({ code, stdout: stripAnsi(stdout), stderr: stripAnsi(stderr) });
    });
  });
}
