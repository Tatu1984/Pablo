// Runs synchronously before hydration so the correct theme class is on <html>
// when the first paint happens — no flash of wrong theme.
export default function ThemeScript() {
  const js = `
  (function(){try{
    var p = localStorage.getItem('pablo-theme');
    var sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = p ? p === 'dark' : sysDark;
    if (dark) document.documentElement.classList.add('dark');
  } catch(e) {}})();
  `;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
