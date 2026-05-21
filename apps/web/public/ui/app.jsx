window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const {
    theme, LANGS, ErrorBoundary, Sidebar, Topbar,
    Store, ChatColumn, InspectorColumn,
    Dashboard, Projects, Builds, Artifacts, Toolchains, Settings, Knowledge, Icon
  } = window.MCFL;

  function App() {
    const [lang, setLang] = useState(localStorage.getItem('mcfl.lang') || 'zh');
    const [t, setT] = useState(LANGS[lang]);
    const [page, setPage] = useState('workspace');
    const [activeTheme, setActiveTheme] = useState(theme.getTheme());
    const [health, setHealth] = useState(null);
    const [storeState, setStoreState] = useState(Store.getState());

    useEffect(() => {
      theme.setTheme(activeTheme);
      const unsub = Store.subscribe(setStoreState);
      return unsub;
    }, []);

    useEffect(() => {
      fetch('/api/health').then((r) => r.ok ? r.json() : null).then(setHealth).catch(() => setHealth(null));
    }, []);

    const handleSetLang = (l) => {
      setLang(l);
      setT(LANGS[l]);
      localStorage.setItem('mcfl.lang', l);
    };

    const handleSetTheme = (newTheme) => {
      setActiveTheme(newTheme);
      theme.setTheme(newTheme);
    };

    const renderContent = () => {
      const props = { t, lang, onSetLang: handleSetLang, onSetTheme: handleSetTheme, theme: activeTheme };

      if (page === 'workspace') {
        return (
          <div className="flex-1 flex overflow-hidden">
            <ChatColumn t={t} />
            <InspectorColumn t={t} />
          </div>
        );
      }

      switch (page) {
        case 'dashboard': return <div className="flex-1 overflow-y-auto"><Dashboard {...props} onSelectProject={(p) => { Store.dispatch('SET_PROJECT', p); setPage('workspace'); }} /></div>;
        case 'projects': return <div className="flex-1 overflow-y-auto"><Projects {...props} onSelectProject={(p) => { Store.dispatch('SET_PROJECT', p); setPage('workspace'); }} /></div>;
        case 'builds': return <div className="flex-1 overflow-y-auto"><Builds {...props} /></div>;
        case 'artifacts': return <div className="flex-1 overflow-y-auto"><Artifacts {...props} /></div>;
        case 'knowledge': return <div className="flex-1 overflow-y-auto"><Knowledge {...props} /></div>;
        case 'toolchains': return <div className="flex-1 overflow-y-auto"><Toolchains {...props} /></div>;
        case 'settings': return <div className="flex-1 overflow-y-auto"><Settings {...props} onSetTheme={handleSetTheme} /></div>;
        default: return <div className="flex-1 overflow-y-auto"><Dashboard {...props} /></div>;
      }
    };

    return (
      <div className="flex h-screen overflow-hidden bg-bg">
        <Sidebar t={t} activePage={page} onNavigate={setPage} isNarrow={true} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar
            t={t}
            project={storeState.activeProject}
            lang={lang}
            onToggleLang={() => handleSetLang(lang === 'zh' ? 'en' : 'zh')}
            health={health}
          />

          {health && health.persistent === false && (
            <div className="bg-danger/10 border-b border-danger/40 text-danger text-[10px] px-4 py-1.5 flex items-center gap-2 shrink-0">
              <Icon name="info" className="w-3 h-3 shrink-0" />
              <span>{t.system?.memoryBackend || "Running with in-memory storage"}</span>
            </div>
          )}

          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </div>
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
})();
