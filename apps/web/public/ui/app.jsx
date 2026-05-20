window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useMemo } = React;
  const { theme, LANGS, ErrorBoundary, Sidebar, Topbar, Dashboard, Projects, Workspace, Builds, Artifacts, Toolchains, Settings, Knowledge, ProjectDetail, Icon } = window.MCFL;

  function App() {
    const [lang, setLang] = useState(localStorage.getItem('mcfl.lang') || 'zh');
    const [t, setT] = useState(LANGS[lang]);
    const [page, setPage] = useState('dashboard');
    const [selectedProject, setSelectedProject] = useState(null);
    const [activeTheme, setActiveTheme] = useState(theme.getTheme());
    const [health, setHealth] = useState(null);
    const [newProjectIntent, setNewProjectIntent] = useState(false);

    const startNewProject = () => {
      setNewProjectIntent(true);
      setPage('projects');
    };

    useEffect(() => {
      theme.setTheme(activeTheme);
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

    const handleSelectProject = (p) => {
      setSelectedProject(p);
      setPage('project-detail');
    };

    const handleOpenWorkspace = (p) => {
      setSelectedProject(p);
      setPage('workspace');
    };

    const renderPage = () => {
      const props = { t, lang, onSetLang: handleSetLang, onSetTheme: handleSetTheme, theme: activeTheme };
      switch (page) {
        case 'dashboard': return <Dashboard {...props} onSelectProject={handleSelectProject} onStartNewProject={startNewProject} />;
        case 'projects': return <Projects {...props} onSelectProject={handleSelectProject} newProjectIntent={newProjectIntent} onConsumeNewProjectIntent={() => setNewProjectIntent(false)} />;
        case 'workspace': return <Workspace {...props} selectedProject={selectedProject} onSelectProject={setSelectedProject} />;
        case 'builds': return <Builds {...props} project={selectedProject} onSelect={setSelectedProject} />;
        case 'artifacts': return <Artifacts {...props} project={selectedProject} onSelect={setSelectedProject} />;
        case 'knowledge': return <Knowledge {...props} />;
        case 'toolchains': return <Toolchains {...props} />;
        case 'settings': return <Settings {...props} onSetTheme={handleSetTheme} />;
        case 'project-detail': return <ProjectDetail {...props} project={selectedProject} onBack={() => setPage('projects')} onSelectWorkspace={handleOpenWorkspace} />;
        default: return <Dashboard {...props} onSelectProject={handleSelectProject} />;
      }
    };

    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar t={t} activePage={page} onNavigate={setPage} />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar t={t} selectedProject={selectedProject} onSetLang={handleSetLang} lang={lang} currentTheme={activeTheme} onToggleTheme={() => handleSetTheme(activeTheme === 'dark' ? 'light' : 'dark')} />
          {health && health.persistent === false && (
            <div className="bg-danger/10 border-b border-danger/40 text-danger text-xs px-4 py-2 flex items-start gap-2">
              {Icon ? <Icon name="info" className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : null}
              <span>{t.system && t.system.memoryBackend}</span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <ErrorBoundary>{renderPage()}</ErrorBoundary>
          </div>
        </main>
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
})();
