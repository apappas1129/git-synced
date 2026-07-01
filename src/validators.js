export function validateHtmlFileName(value) {
  if (!value || !value.trim()) return 'HTML file name is required.';
  if (!value.endsWith('.html')) return 'File name must end with ".html".';
  return true;
}
