/**
 * Applies the stored theme before first paint so a dark-mode user never sees
 * a white flash. Inline by necessity — it has to run before hydration.
 */
export function ThemeScript() {
  const script = `
try {
  var t = localStorage.getItem('unimate-theme');
  if (t === 'dark' || t === 'light') {
    document.documentElement.setAttribute('data-theme', t);
  }
} catch (e) {}
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
