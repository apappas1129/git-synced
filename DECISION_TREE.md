# Decision Tree

A map of every branch in the `git-synced` CLI flow, kept in sync with the code as the tool grows.

> **Keep this updated.** Any time you add a new prompt, flag, or branch to the flow, update the diagram and the matching entry below in the same change.

## Flow diagram

```mermaid
flowchart TD
  Start([git-synced invoked]) --> ParseArgs["parseArgs (src/cli.js)"]
  ParseArgs --> HelpCheck{"--help / -h?"}
  HelpCheck -- yes --> PrintHelp[printHelp] --> ExitHelp(["exit 0"])
  HelpCheck -- no --> VersionCheck{"--version / -v?"}
  VersionCheck -- yes --> PrintVersion[printVersion] --> ExitVersion(["exit 0"])
  VersionCheck -- no --> Logo["printLogo (src/logo.js)"]

  Logo --> GitCheck{"ensureGitRepository:\ninside a git work tree?\n(src/commitScript.js)"}
  GitCheck -- no --> GitErr["print 'not a git repository'"] --> ExitGitErr(["exit 1"])
  GitCheck -- yes --> FileSource{"--file / -f given?"}

  FileSource -- yes --> ValidateFlag{"validateHtmlFileName ok?\n(src/validators.js)"}
  ValidateFlag -- no --> FlagErr["print validation error"] --> ExitFlagErr(["exit 1"])
  ValidateFlag -- yes --> ResolvePath["path.resolve(cwd, fileName)"]
  FileSource -- no --> PromptFile["promptFileName\n(same validation, re-prompts until valid)"] --> ResolvePath

  ResolvePath --> ReadFile{"fs.readFile succeeds?"}
  ReadFile -- "no (e.g. ENOENT)" --> ReadErr["catch block: print error"] --> ExitReadErr(["exit 1"])
  ReadFile -- yes --> EmptyCheck{"page.length > 0?"}
  EmptyCheck -- no --> EmptyErr["print 'file is empty'"] --> ExitEmptyErr(["exit 1"])
  EmptyCheck -- yes --> PrintLines["print line count"]

  PrintLines --> PromptCommitter["promptCommitterName / promptCommitterEmail / promptCommitMessage"]
  PromptCommitter --> Scrape["scrapeCommits\n(src/scraper.js — parses td[data-date][data-level] + tool-tip)"]
  Scrape --> SpinStart["start spinner 'Generating commits'"]
  SpinStart --> WriteScriptCall["writeScript (src/commitScript.js)"]

  WriteScriptCall --> HasHead{"git rev-parse --verify HEAD ok?"}
  HasHead -- "fails with unexpected error" --> WSReject1["reject(error)"]
  HasHead -- "ok, or 'no commits yet'" --> LoopCommits["for each date, for each commit index in that day's count"]

  LoopCommits --> ExistingCheck{"repo has commits AND\ngit log --grep matches this message?"}
  ExistingCheck -- match found --> SkipBranch["print 'skipping', consecutiveSkips++"]
  SkipBranch --> SkipThreshold{"consecutiveSkips > 20\nand countSkips still true?"}
  SkipThreshold -- yes --> ConfirmSkip{"promptContinueDespiteSkips"}
  ConfirmSkip -- no --> CancelOp["print 'Operation cancelled'"] --> ExitCancel(["exit 0"])
  ConfirmSkip -- yes --> DisableSkipCount["countSkips = false"] --> LoopCommits
  SkipThreshold -- no --> LoopCommits
  ExistingCheck -- no match --> AppendCommit["reset consecutiveSkips, append 'git commit --allow-empty ...' line to scriptContent"] --> LoopCommits

  LoopCommits -- loop finished --> ScriptContentCheck{"scriptContent non-empty?"}
  ScriptContentCheck -- no --> WSReject2["reject('No commits were generated')"]
  ScriptContentCheck -- yes --> WriteFile["write script.sh, print success"] --> WSResolve["resolve()"]

  WSReject1 --> CatchAll["outer .catch: print error"] --> ExitCatch(["exit 1"])
  WSReject2 --> CatchAll

  WSResolve --> PromptExecute{"promptExecuteScript"}
  PromptExecute -- no --> ExitNoExec(["exit 0"])
  PromptExecute -- yes --> RunScript["runCommitScript: exec('bash script.sh')\n(src/executeScript.js)"]

  RunScript --> ExecResult{"exec succeeds?"}
  ExecResult -- no --> ExecErr["print execution error"] --> ExitExecErr(["exit 1"])
  ExecResult -- yes --> PrintSuccess["print success + 'why aren't my contributions showing up' help"] --> ExitSuccess(["exit 0"])
```

## Walkthrough

| Node | Responsible code | Outcome |
| --- | --- | --- |
| `--help` / `-h` | `parseArgs`, `printHelp` in `src/cli.js` | Prints usage, **exit 0**. Runs before the logo or any git/file access. |
| `--version` / `-v` | `parseArgs`, `printVersion` in `src/cli.js` | Prints `package.json` version, **exit 0**. |
| Not a git repository | `ensureGitRepository` in `src/commitScript.js` (`git rev-parse --is-inside-work-tree`) | Prints a friendly error and **exit 1**, before any prompts run. This is the first real gate once the tool is installed globally and can be run from any directory. |
| `--file` given but invalid | `validateHtmlFileName` in `src/validators.js`, checked directly in `index.js` | Prints the validation message (empty value or missing `.html` suffix) and **exit 1**. |
| `--file` given and valid / no `--file` | `path.resolve(process.cwd(), fileName)` in `index.js` | Resolved relative to the user's current working directory (not the package install directory) or used as-is if already absolute. |
| HTML file missing/unreadable | outer `try/catch` around `fs.readFile` in `index.js` | Prints the raw fs error, **exit 1**. |
| HTML file empty | `index.js`, right after `fs.readFile` | Prints "The file is empty.", **exit 1**. |
| Committer name / email / commit message prompts | `src/prompts.js` | Re-prompt on invalid input (empty name, malformed email); no exit path — these only proceed once valid. |
| Scraping | `scrapeCommits` in `src/scraper.js` | Parses `td[data-date][data-level]` cells + matching `tool-tip` text into a `Map<date, count>`. Zero days found is not an error — it flows through and simply produces an empty `scriptContent` later. |
| `git rev-parse --verify HEAD` fails unexpectedly | `writeScript` in `src/commitScript.js` | Rejects the promise with the raw git error, caught by the outer `.catch` in `index.js`, **exit 1**. |
| Commit already exists (`git log --grep` match) | `writeScript` loop | Skipped, printed as "Skipping commit that already exists", `consecutiveSkips` incremented. This is what makes re-running the tool against the same HTML idempotent. |
| More than 20 consecutive skips | `writeScript`, via `promptContinueDespiteSkips` in `src/prompts.js` | Asks the user to confirm the HTML content is correct. Decline → "Operation cancelled.", **exit 0**. Accept → skip-counting is disabled for the rest of the run (`countSkips = false`) so the prompt won't fire again. |
| No new commits generated at all | `writeScript` | Rejects with `'No commits were generated.'`, caught by the outer `.catch`, **exit 1**. |
| Commits generated | `writeScript` | Writes `script.sh` to the current directory, prints success, resolves. |
| Execute-script confirmation declined | `promptExecuteScript` in `src/prompts.js`, handled in `index.js` | **exit 0** — `script.sh` is left on disk for the user to inspect/run manually. |
| Execute-script confirmation accepted, `bash script.sh` fails | `runCommitScript` in `src/executeScript.js` | Prints the execution error and calls **exit 1** directly (not via promise rejection — matches the original inline behavior). |
| Execute-script confirmation accepted, succeeds | `runCommitScript` | Prints stdout/stderr, success message, `git push` reminder, and the GitHub "contributions not showing up" guidance. **exit 0**. |
