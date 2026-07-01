import { load } from 'cheerio';

// GitHub-DOM-coupled: if the profile page markup changes, this is the only
// file that should need updating.
export function scrapeCommits(page) {
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
