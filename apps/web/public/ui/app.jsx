window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useMemo } = React;
  const { theme, LANGS, ErrorBoundary, Sidebar, Topbar, Dashboard, Projects, Workspace, Builds, Artifacts, Toolchains, Settings, Knowledge, ProjectDetail } = window.MCFL;

  function App() {
    const [lang, setLang] = useState(localStorage.getItem('mcfl.lang') || 'zh');
    const [t, setT] = useState(LANGS[lang]);
    const [page, setPage] = useState('dashboard');
    const [selectedProject, setSelectedProject] = useState(null);
    const [activeTheme, setActiveTheme] = useState(theme.getTheme());

    useEffect(() => {
      theme.setTheme(activeTheme);
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
        case 'dashboard': return <Dashboard {...props} onSelectProject={handleSelectProject} />;
        case 'projects': return <Projects {...props} onSelectProject={handleSelectProject} />;
        case 'workspace': return <Workspace {...props} selectedProject={selectedProject} onSelectProject={setSelectedProject} />;
        case 'builds': return <Builds {...props} selectedProject={selectedProject} onSelectProject={setSelectedProject} />;
        case 'artifacts': return <Artifacts {...props} selectedProject={selectedProject} onSelectProject={setSelectedProject} />;
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
