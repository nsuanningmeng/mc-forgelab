// MC-AI-ForgeLab Workbench — entry point
// Replaces the legacy single-file UI. All components are pre-loaded onto window.MCFL.

(function () {
  const { useState, useEffect, useCallback } = React;
  const M = window.MCFL;
  const { AppShell, Dashboard, Workspace, Projects, Workflows, Builds, Artifacts, Toolchains, Settings, api } = M;

  function App() {
    const [page, setPage] = useState("dashboard");
    const [selectedProject, setSelectedProject] = useState(null);
    const [health, setHealth] = useState(null);
    const [providers, setProviders] = useState([]);
    const [lang, setLang] = useState(() => {
      try {
        const saved = localStorage.getItem("mcfl.lang");
        if (saved === "zh" || saved === "en") return saved;
      } catch {/* ignore */}
      return (navigator.language || "zh").toLowerCase().startsWith("zh") ? "zh" : "en";
    });
    const t = M.LANGS[lang];

    // Hide boot overlay once React mounts.
    useEffect(() => {
      const el = document.getElementById("mcfl-boot");
      if (!el) return;
      el.classList.add("hide");
      const id = setTimeout(() => el.remove(), 280);
      return () => clearTimeout(id);
    }, []);

    useEffect(() => {
      try { localStorage.setItem("mcfl.lang", lang); } catch {/* ignore */}
      document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
      document.title = `${M.LANGS[lang].appName} · ${M.LANGS[lang].appTagline}`;
    }, [lang]);

    useEffect(() => {
      api.health().then(setHealth).catch(() => setHealth({ ok: false, version: "?" }));
      api.providers().then(setProviders).catch(() => setProviders([]));
    }, []);

    const providerOk = providers.some((p) => p.enabled);
    const toggleLang = useCallback(() => setLang((l) => (l === "zh" ? "en" : "zh")), []);
    const handleSelectProject = useCallback((p) => setSelectedProject(p), []);

    const renderPage = () => {
      switch (page) {
        case "dashboard":  return <Dashboard t={t} onSelectProject={handleSelectProject} onNavigate={setPage} />;
        case "workspace":  return <Workspace t={t} selectedProject={selectedProject} onSelectProject={handleSelectProject} />;
        case "projects":   return <Projects t={t} onSelect={handleSelectProject} selectedProject={selectedProject} />;
        case "workflows":  return <Workflows t={t} />;
        case "builds":     return <Builds t={t} />;
        case "artifacts":  return <Artifacts t={t} project={selectedProject} onSelect={handleSelectProject} />;
        case "toolchains": return <Toolchains t={t} />;
        case "settings":   return <Settings t={t} lang={lang} onSetLang={setLang} />;
        default:           return <Dashboard t={t} onSelectProject={handleSelectProject} onNavigate={setPage} />;
      }
    };

    return (
      <AppShell
        page={page}
        onNavigate={setPage}
        project={selectedProject}
        mode="single"
        providerOk={providerOk}
        buildQueue="idle"
        health={health}
        lang={lang}
        onToggleLang={toggleLang}
        t={t}
      >
        {renderPage()}
      </AppShell>
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
