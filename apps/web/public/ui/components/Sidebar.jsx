window.MCFL = window.MCFL || {};
(function () {
  const { cx, Icon } = window.MCFL;

  function Sidebar({ t, activePage, onNavigate, isNarrow }) {
    const items = [
      { id: "workspace", icon: "spark", label: t.nav.workspace },
      { id: "artifacts", icon: "box", label: t.nav.artifacts },
      { id: "settings", icon: "cog", label: t.nav.settings },
    ];

    if (isNarrow) {
      return (
        <aside className="w-16 bg-surface border-r border-border flex flex-col items-center py-4 shrink-0 h-full">
          <div className="w-8 h-8 bg-mc rounded-lg flex items-center justify-center mb-8 shadow-lg shadow-mc/20">
            <div className="w-4 h-4 border-2 border-surface rotate-45" />
          </div>

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

          <div className="mt-auto flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-mc/20 to-mc/40 border border-mc/30 flex items-center justify-center text-[10px] font-bold text-mc shadow-inner group cursor-default">
              <span className="group-hover:scale-110 transition-transform">FL</span>
            </div>
          </div>
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

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
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

        <div className="p-4 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-mc to-mc/60 border-2 border-surface shadow-md flex items-center justify-center text-[11px] font-bold text-white shrink-0">
              FL
            </div>
            <div className="flex flex-col min-w-0">
              <div className="text-xs font-bold text-tx1 truncate">ForgeLab User</div>
              <div className="text-[10px] text-tx3 font-mono">v0.4.4</div>
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" title="Online" />
        </div>
      </aside>
    );
  }

  window.MCFL.Sidebar = Sidebar;
})();
