// Topbar — current project, mode, AI/Build status, lang toggle, GitHub link
window.MCFL = window.MCFL || {};
(function () {
  const { cx, Icon, StatusBadge } = window.MCFL;

  function Topbar({ project, mode, providerOk, buildQueue, health, lang, onToggleLang, t }) {
    return (
      <header className="h-12 shrink-0 border-b border-border bg-surface flex items-center gap-3 px-4">
        {/* breadcrumb */}
        <div className="flex items-center gap-2 min-w-0 text-sm">
          <span className="text-tx3 mcfl-mono text-2xs uppercase tracking-wider">project</span>
          <Icon name="chevronR" className="w-3 h-3 text-tx3" />
          <span className={cx.j("text-tx1 truncate", project ? "" : "text-tx3 italic")}>
            {project ? project.name : t.topbar.noProject}
          </span>
          {project && (
            <span className={cx.j("text-2xs text-tx3", cx.mono)}>
              · {project.target_id} · {project.minecraft_version}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* runtime info */}
        <div className="hidden md:flex items-center gap-2 text-2xs text-tx2">
          <span className="uppercase tracking-wider text-tx3">{t.topbar.mode}:</span>
          <StatusBadge
            variant={mode === "workflow" ? "info" : "neutral"}
            label={mode === "multi-model" ? t.topbar.workflow : t.topbar.singleModel}
            dot={false}
          />
          <span className="uppercase tracking-wider text-tx3 ml-2">{t.topbar.provider}:</span>
          <StatusBadge
            variant={providerOk ? "success" : "warn"}
            label={providerOk ? "online" : "not configured"}
          />
          <span className="uppercase tracking-wider text-tx3 ml-2">{t.topbar.buildQueue}:</span>
          <StatusBadge variant="success" label={buildQueue ?? "idle"} dot={false} />
        </div>

        <div className="flex items-center gap-1 ml-2">
          {health && (
            <span className={cx.j("text-2xs text-tx3 hidden lg:inline", cx.mono)}>
              v{health.version}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleLang}
            className={cx.btnIcon}
            title={t.topbar.toggleLang}
            aria-label={t.topbar.toggleLang}
          >
            <Icon name="globe" className="w-4 h-4" />
            <span className="ml-1 text-2xs">{lang.toUpperCase()}</span>
          </button>
          <a
            href="https://github.com/nsuanningmeng/mc-forgelab"
            target="_blank"
            rel="noopener noreferrer"
            className={cx.btnIcon}
            title={t.topbar.github}
            aria-label={t.topbar.github}
          >
            <Icon name="external" className="w-4 h-4" />
          </a>
        </div>
      </header>
    );
  }

  window.MCFL.Topbar = Topbar;
})();
