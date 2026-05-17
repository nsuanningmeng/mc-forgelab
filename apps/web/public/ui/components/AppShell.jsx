// AppShell — sidebar + topbar + page slot
window.MCFL = window.MCFL || {};
(function () {
  const { Sidebar, Topbar } = window.MCFL;

  function AppShell({ page, onNavigate, project, mode, providerOk, buildQueue, health, lang, onToggleLang, t, children }) {
    return (
      <div className="h-screen w-screen flex bg-bg text-tx1 overflow-hidden">
        <Sidebar page={page} onNavigate={onNavigate} t={t} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar
            project={project}
            mode={mode}
            providerOk={providerOk}
            buildQueue={buildQueue}
            health={health}
            lang={lang}
            onToggleLang={onToggleLang}
            t={t}
          />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    );
  }

  window.MCFL.AppShell = AppShell;
})();
