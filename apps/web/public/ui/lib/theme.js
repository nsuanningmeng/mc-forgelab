window.MCFL = window.MCFL || {};
window.MCFL.theme = (() => {
  const KEY = 'mcfl.theme';
  
  function getTheme() {
    return localStorage.getItem(KEY) || 'system';
  }

  function applyTheme(t) {
    let actualTheme = t;
    if (t === 'system') {
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    document.documentElement.setAttribute('data-theme', actualTheme);
    if (actualTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function setTheme(t) {
    localStorage.setItem(KEY, t);
    applyTheme(t);
    // Dispatch event for components that need to react manually
    window.dispatchEvent(new CustomEvent('mcfl-theme-change', { detail: t }));
  }

  // Listen for system theme changes if set to 'system'
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') {
      applyTheme('system');
    }
  });

  // Initial apply
  applyTheme(getTheme());

  return { getTheme, setTheme };
})();
