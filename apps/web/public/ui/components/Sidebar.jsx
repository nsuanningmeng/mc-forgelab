window.MCFL = window.MCFL || {};
(function () {
  const { cx, Icon, ProjectCard } = window.MCFL;

  function Sidebar({ t, activePage, onNavigate, isNarrow, projects, activeProjectId, onSelectProject, onCreateProject }) {
    const items = [
      { id: "workspace", icon: "spark", label: t.nav.workspace },
      { id: "artifacts", icon: "box", label: t.nav.artifacts },
      { id: "settings", icon: "cog", label: t.nav.settings },
    ];

    const projectList = Array.isArray(projects) ? projects : [];

    if (isNarrow) {
      return (
        <aside className="w-16 bg-surface border-r border-border flex flex-col items-center py-4 shrink-0 h-full">
          <img src="assets/icon.png" alt="ForgeLab" className="w-8 h-8 rounded-lg mb-8 shadow-lg shadow-mc/20" />

          <nav className="flex-1 flex flex-col gap-4">
            {items.map((item) => (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                title={item.label}
                onClick={() => onNavigate(item.id)}
                className={cx.j(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all relative group",
                  activePage === item.id || (activePage === 'project-detail' && item.id === 'projects') ? "bg-mc/10 text-mc" : "text-tx3 hover:text-tx1 hover:bg-elevated"
                )}
              >
                <Icon name={item.icon} className="w-5 h-5" />
                {activePage === item.id && (
                  <div className="absolute left-0 w-1 h-4 bg-mc rounded-r-full" />
                )}
                {item.id === "workspace" && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-mc border-2 border-surface" />
                )}
                <div className="absolute left-14 px-2 py-1 bg-elevated border border-border rounded text-[10px] text-tx1 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.label}
                </div>
              </button>
            ))}
          </nav>
        </aside>
      );
    }

    return (
      <aside className="w-[240px] bg-surface border-r border-border flex flex-col h-full shrink-0">
        <div className="h-14 px-6 flex items-center border-b border-border/50">
          <div className="w-6 h-6 bg-mc rounded flex items-center justify-center mr-3 shadow-lg shadow-mc/20">
            <div className="w-3 h-3 border-2 border-surface rotate-45" />
          </div>
          <span className="font-bold text-tx1 tracking-tight text-lg">{t.appName}</span>
        </div>

        <nav className="p-3 space-y-1 border-b border-border/50">
          {items.map((item) => (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => onNavigate(item.id)}
              className={activePage === item.id || (activePage === 'project-detail' && item.id === 'projects') ? cx.navItemActive : cx.navItem}
            >
              <Icon name={item.icon} className="w-4 h-4" />
              <span>{item.label}</span>
              {item.id === "workspace" && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-mc animate-pulse" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30">
          <span className="text-xs font-semibold text-tx2 uppercase tracking-wider">{t.nav?.projects || "Projects"}</span>
          <button
            onClick={onCreateProject}
            className="w-6 h-6 rounded flex items-center justify-center text-tx3 hover:text-mc hover:bg-mc/10 transition-colors"
            title={t.proj?.newProject || "New project"}
            data-testid="sidebar-new-project-btn"
          >
            <Icon name="plus" className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {projectList.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-tx3">
              <p>{t.ws?.noProjectHint || "No projects yet."}</p>
              <button
                onClick={onCreateProject}
                className="mt-2 text-mc hover:underline text-xs font-medium"
              >
                {t.proj?.newProject || "Create one"}
              </button>
            </div>
          ) : (
            projectList.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                selected={p.id === activeProjectId}
                onSelect={onSelectProject}
              />
            ))
          )}
        </div>
      </aside>
    );
  }

  window.MCFL.Sidebar = Sidebar;
})();
