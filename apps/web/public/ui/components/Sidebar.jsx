window.MCFL = window.MCFL || {};
(function () {
  const { cx, Icon } = window.MCFL;

  function Sidebar({ t, activePage, onNavigate }) {
    const items = [
      { id: "dashboard", icon: "dashboard", label: t.nav.dashboard },
      { id: "workspace", icon: "spark", label: t.nav.workspace },
      { id: "projects", icon: "folder", label: t.nav.projects },
      { id: "builds", icon: "terminal", label: t.nav.builds },
      { id: "artifacts", icon: "box", label: t.nav.artifacts },
      { id: "settings", icon: "cog", label: t.nav.settings },
    ];

    return (
      <aside className="w-[240px] bg-surface border-r border-border flex flex-col h-full shrink-0">
        <div className="h-14 px-6 flex items-center border-b border-border/50">
          <div className="w-6 h-6 bg-mc rounded flex items-center justify-center mr-3">
            <div className="w-3 h-3 border-2 border-surface rotate-45" />
          </div>
          <span className="font-bold text-tx1 tracking-tight">{t.appName}</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {items.map((item) => (
            <button
              key={item.id}
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

        <div className="p-4 border-t border-border/50">
          <div className="bg-elevated rounded-md p-3">
            <div className="text-2xs text-tx3 uppercase tracking-wider mb-1">Runtime Version</div>
            <div className="text-xs font-mono text-mc">v0.3.1</div>
          </div>
        </div>
      </aside>
    );
  }

  window.MCFL.Sidebar = Sidebar;
})();
