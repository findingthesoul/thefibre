// Inlined into <head> to apply the theme class before first paint — avoids
// the light→dark flash. Reads the cookie set by the user menu.
// Extracted 2026-09-05 (component-inventory Phase 1) from six identical copies.
export function ThemeScript() {
  const code = `(function(){try{
    var m = document.cookie.match(/(?:^|; )thefibre\\.theme=([^;]+)/);
    var t = m ? decodeURIComponent(m[1]) : 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
