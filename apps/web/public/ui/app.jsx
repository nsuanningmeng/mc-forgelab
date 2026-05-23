window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const {
    theme, LANGS, ErrorBoundary, Sidebar, Topbar,
    Store, ChatColumn, InspectorColumn, api,
    Artifacts, Toolchains, Settings, Knowledge, Icon
  } = window.MCFL;

  function App() {
    const [lang, setLang] = useState(localStorage.getItem('mcfl.lang') || 'zh');
    const [t, setT] = useState(LANGS[lang]);
    const [page, setPage] = useState('workspace');
    const [activeTheme, setActiveTheme] = useState(theme.getTheme());
    const [health, setHealth] = useState(null);
    const [storeState, setStoreState] = useState(Store.getState());
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
      theme.setTheme(activeTheme);
      const unsub = Store.subscribe(setStoreState);
      // Load projects once at app level so sidebar always has them
      api.projects().then(ps => Store.dispatch('SET_PROJECTS', ps)).catch(() => {});
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

    const handleSelectProject = (project) => {
      Store.dispatch('SET_PROJECT', project);
      if (page !== 'workspace') setPage('workspace');
    };

    const handleCreateProject = () => {
      const name = lang === 'zh' ? '新项目' : 'New Project';
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'untitled';
      api.createProject({
        name,
        targetId: 'paper',
        minecraftVersion: '1.21.4',
        packageName: 'com.example.' + slug
      }).then(project => {
        return api.projects().then(ps => {
          Store.dispatch('SET_PROJECTS', ps);
          Store.dispatch('SET_PROJECT', project);
          if (page !== 'workspace') setPage('workspace');
        });
      }).catch(err => {
        Store.dispatch('ADD_MESSAGE', { role: 'system', type: 'error', content: 'Failed to create project: ' + err.message });
      });
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
        case 'artifacts': return <div className="flex-1 overflow-y-auto"><Artifacts {...props} /></div>;
        case 'knowledge': return <div className="flex-1 overflow-y-auto"><Knowledge {...props} /></div>;
        case 'toolchains': return <div className="flex-1 overflow-y-auto"><Toolchains {...props} /></div>;
        case 'settings': return <div className="flex-1 overflow-y-auto"><Settings {...props} onSetTheme={handleSetTheme} /></div>;
        default: return (
          <div className="flex-1 flex overflow-hidden">
            <ChatColumn t={t} />
            <InspectorColumn t={t} />
          </div>
        );
      }
    };

    const showWideSidebar = !sidebarCollapsed && (page === 'workspace' || page === 'project-detail');

    return (
      <div className="flex h-screen overflow-hidden bg-bg">
        {showWideSidebar ? (
          <Sidebar
            t={t}
            activePage={page}
            onNavigate={setPage}
            isNarrow={false}
            projects={storeState.projects}
            activeProjectId={storeState.activeProjectId}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
          />
        ) : (
          <Sidebar
            t={t}
            activePage={page}
            onNavigate={(p) => {
              if (p === 'workspace') setSidebarCollapsed(false);
              setPage(p);
            }}
            isNarrow={true}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar
            t={t}
            project={storeState.activeProject}
            mode={storeState.workflows?.find(w => w.id === storeState.activeWorkflowId)?.mode}
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
