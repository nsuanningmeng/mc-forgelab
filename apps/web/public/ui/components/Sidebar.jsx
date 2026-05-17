// Sidebar — primary navigation, 8 entries
window.MCFL = window.MCFL || {};
(function () {
  const { cx, Icon, StatusBadge } = window.MCFL;

  // [id, iconName, navKey, wired?]
  const ITEMS = [
    ["dashboard",  "dashboard", "dashboard",  true],
    ["workspace",  "cpu",       "workspace",  false],
    ["projects",   "folder",    "projects",   true],
    ["workflows",  "git",       "workflows",  true],
    ["builds",     "terminal",  "builds",     true],
    ["artifacts",  "box",       "artifacts",  true],
    ["toolchains", "wrench",    "toolchains", true],
    ["settings",   "cog",       "settings",   true],
  ];

  function Sidebar({ page, onNavigate, t }) {
    return (
      <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-mc/15 border border-mc/30 flex items-center justify-center">
              <Icon name="cube" className="w-4 h-4 text-mc" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-tx1 leading-tight truncate">{t.appName}</div>
              <div className="text-2xs text-tx3 leading-tight truncate">{t.appTagline}</div>
            </div>
          </div>
        </div>

        <nav className="px-2 py-3 flex-1 overflow-y-auto space-y-0.5">
          {ITEMS.map(([id, icon, key, wired]) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={page === id ? cx.navItemActive : cx.navItem}
            >
              <Icon name={icon} className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left truncate">{t.nav[key]}</span>
              {!wired && (
                <span className="text-[9px] uppercase tracking-wider text-tx3 font-semibold">
                  planned
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 py-2 border-t border-border">
          <div className="flex items-center justify-between gap-2 text-2xs text-tx3">
            <span>{t.earlyDev}</span>
            <StatusBadge variant="warn" label="AGPL · v0.1" dot={false} />
          </div>
        </div>
      </aside>
    );
  }

  window.MCFL.Sidebar = Sidebar;
})();
