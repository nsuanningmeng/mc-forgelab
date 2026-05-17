// Dashboard — workbench overview
window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, MetricCard, PageHeader, EmptyState, StatusBadge, ProjectCard } = window.MCFL;

  function Dashboard({ t, onSelectProject, onNavigate }) {
    const [projects, setProjects] = useState(null);
    const [workflows, setWorkflows] = useState(null);
    const [runs, setRuns] = useState(null);
    const [providers, setProviders] = useState(null);
    const [health, setHealth] = useState(null);

    useEffect(() => {
      api.projects().then(setProjects).catch(() => setProjects([]));
      api.workflows().then(setWorkflows).catch(() => setWorkflows([]));
      api.workflowRuns().then(setRuns).catch(() => setRuns([]));
      api.providers().then(setProviders).catch(() => setProviders([]));
      api.health().then(setHealth).catch(() => setHealth(null));
    }, []);

    const enabledProviders = (providers || []).filter((p) => p.enabled);
    const providerOk = enabledProviders.length > 0;

    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <PageHeader
          title={t.dash.title}
          subtitle={t.dash.subtitle}
          badge={<StatusBadge variant="warn" label={t.earlyDev} />}
          actions={
            <>
              <button onClick={() => onNavigate("projects")} className={cx.btnPrimary}>
                <Icon name="plus" className="w-3.5 h-3.5" />
                {t.dash.newProject}
              </button>
              <button onClick={() => onNavigate("settings")} className={cx.btnSecondary}>
                <Icon name="cog" className="w-3.5 h-3.5" />
                {t.dash.configureProvider}
              </button>
            </>
          }
        />

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MetricCard
            label={t.dash.mProjects}
            value={projects ? projects.length : "—"}
            icon="folder"
            loading={projects === null}
          />
          <MetricCard
            label={t.dash.mWorkflows}
            value={workflows ? workflows.length : "—"}
            icon="git"
            loading={workflows === null}
          />
          <MetricCard
            label={t.dash.mRuns}
            value={runs ? runs.length : "—"}
            icon="terminal"
            tone="info"
            loading={runs === null}
          />
          <MetricCard
            label={t.dash.providerStatus}
            value={providerOk ? enabledProviders.length : 0}
            hint={providerOk ? "enabled" : "none configured"}
            icon="cpu"
            tone={providerOk ? "success" : "warn"}
            loading={providers === null}
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
          <div className={cx.j(cx.card, cx.cardPad)}>
            <div className={cx.sectionTitle}>{t.dash.service}</div>
            <div className={cx.j("text-2xl font-semibold", health?.ok ? "text-mc" : "text-danger", cx.mono)}>
              {health == null ? "—" : health.ok ? t.dash.running : t.dash.offline}
            </div>
            <div className={cx.j("text-2xs text-tx3 mt-1", cx.mono)}>
              {t.dash.version} {health?.version || "—"}
            </div>
          </div>
          <div className={cx.j(cx.card, cx.cardPad)}>
            <div className={cx.sectionTitle}>{t.dash.toolchainStatus}</div>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge variant="planned" label={t.planned} />
            </div>
            <div className="text-2xs text-tx3 mt-1">JDK / Gradle / Maven detection planned.</div>
          </div>
          <div className={cx.j(cx.card, cx.cardPad)}>
            <div className={cx.sectionTitle}>{t.dash.quickStart}</div>
            <div className="space-y-1.5 mt-1">
              <button onClick={() => onNavigate("projects")} className={cx.j(cx.btnSecondary, "w-full justify-start")}>
                <Icon name="plus" className="w-3.5 h-3.5" /> {t.dash.newProject}
              </button>
              <a
                href="https://github.com/nsuanningmeng/mc-forgelab"
                target="_blank"
                rel="noopener noreferrer"
                className={cx.j(cx.btnGhost, "w-full justify-start")}
              >
                <Icon name="external" className="w-3.5 h-3.5" /> {t.dash.viewGitHub}
              </a>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
            <div className={cx.sectionTitle}>{t.dash.recentProjects}</div>
            {projects === null ? (
              <div className={cx.j(cx.card, "px-4 py-8 text-center text-tx3 text-sm")}>{t.common.loading}…</div>
            ) : projects.length === 0 ? (
              <EmptyState icon="folder" title={t.dash.noProjects} variant="early-dev" />
            ) : (
              <div className="space-y-1.5">
                {projects.slice(0, 6).map((p) => (
                  <ProjectCard key={p.id} project={p} onSelect={onSelectProject} />
                ))}
              </div>
            )}
          </div>
          <div>
            <div className={cx.sectionTitle}>{t.dash.recentRuns}</div>
            {runs === null ? (
              <div className={cx.j(cx.card, "px-4 py-8 text-center text-tx3 text-sm")}>{t.common.loading}…</div>
            ) : runs.length === 0 ? (
              <EmptyState icon="terminal" title={t.dash.noRuns} variant="early-dev" />
            ) : (
              <div className={cx.j(cx.card, "divide-y divide-border")}>
                {runs.slice(0, 6).map((r) => (
                  <div key={r.id} className="px-3 py-2 flex items-center gap-3">
                    <StatusBadge variant={window.MCFL.statusVariant(r.status)} label={r.status || "pending"} />
                    <span className={cx.j("text-sm text-tx1 truncate flex-1", cx.mono)}>{r.workflow_id || r.id}</span>
                    <span className={cx.j("text-2xs text-tx3", cx.mono)}>
                      {(r.started_at || "").slice(0, 19).replace("T", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  window.MCFL.Dashboard = Dashboard;
})();
