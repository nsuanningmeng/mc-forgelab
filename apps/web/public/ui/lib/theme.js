window.MCFL = window.MCFL || {};
window.MCFL.theme = (() => {
  const KEY = 'mcfl.theme';
  
  function getTheme() {
    return localStorage.getItem(KEY) || 'dark';
  }

  function setTheme(t) {
    localStorage.setItem(KEY, t);
    document.documentElement.setAttribute('data-theme', t);
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Dispatch event for components that need to react manually
    window.dispatchEvent(new CustomEvent('mcfl-theme-change', { detail: t }));
  }

  return { getTheme, setTheme };
})();
