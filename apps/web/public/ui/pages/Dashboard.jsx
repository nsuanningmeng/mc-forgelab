window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, MetricCard, ProjectCard, EmptyState, ActivityPanel, Icon } = window.MCFL;

  function Dashboard({ t, onSelectProject }) {
    const [stats, setStats] = useState({ projects: 0, workflows: 0, runs: 0, artifacts: 0 });
    const [projects, setProjects] = useState([]);
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      Promise.all([
        api.projects(),
        api.workflows(),
        api.workflowRuns(),
        api.health(),
      ]).then(([p, wf, runs, health]) => {
        setProjects(p);
        setRuns(runs);
        setStats({
          projects: p.length,
          workflows: wf.length,
          runs: runs.length,
          artifacts: 0 // Fetching total artifacts might be heavy, leave as 0 for now
        });
      }).catch(err => {
        console.error("Dashboard load failed", err);
      }).finally(() => setLoading(false));
    }, []);

    return (
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title={t.dash.mProjects} value={stats.projects} icon="folder" />
          <MetricCard title={t.dash.mWorkflows} value={stats.workflows} icon="cpu" />
          <MetricCard title={t.dash.mRuns} value={stats.runs} icon="activity" />
          <MetricCard title={t.dash.mArtifacts} value={stats.artifacts} icon="package" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className={cx.sectionTitle}>{t.dash.recentProjects}</h2>
                <button className="text-2xs text-mc hover:underline font-semibold uppercase tracking-wider">{t.common.details} →</button>
              </div>
              {projects.length === 0 ? (
                <EmptyState icon="folder" title={t.dash.noProjects} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {projects.slice(0, 4).map(p => (
                    <ProjectCard key={p.id} project={p} onSelect={onSelectProject} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className={cx.sectionTitle}>{t.dash.recentRuns}</h2>
              {runs.length === 0 ? (
                <EmptyState icon="activity" title={t.dash.noRuns} variant="neutral" />
              ) : (
                <div className={cx.tableWrap}>
                  <table className="w-full text-left">
                    <thead className={cx.tableHead}>
                      <tr>
                        <th className={cx.tableTh}>{t.common.projects}</th>
                        <th className={cx.tableTh}>{t.wf.mode}</th>
                        <th className={cx.tableTh}>{t.wf.status}</th>
                        <th className={cx.tableTh}>{t.wf.startedAt}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.slice(0, 5).map(r => {
                        const startedAt = r && (r.started_at || r.startedAt);
                        const projectId = r && (r.project_id || r.projectId);
                        return (
                          <tr key={r.id} className={cx.tableRow}>
                            <td className={cx.tableTd}>{r.projectName || projectId || "—"}</td>
                            <td className={cx.tableTd}><span className="text-2xs uppercase text-tx3">{r.mode || "—"}</span></td>
                            <td className={cx.tableTd}>
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${r.status === 'success' ? 'bg-mc' : r.status === 'running' ? 'bg-blue animate-pulse' : 'bg-danger'}`} />
                                <span className="text-xs">{r.status || "pending"}</span>
                              </div>
                            </td>
                            <td className={cx.tableTd}>
                              <span className="text-tx3 tabular-nums">
                                {startedAt ? new Date(startedAt).toLocaleString() : "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <ActivityPanel t={t} />
            
            <div className={cx.j(cx.card, "p-4")}>
              <h3 className={cx.sectionTitle}>{t.dash.quickStart}</h3>
              <div className="space-y-2 mt-3">
                <button className={cx.j(cx.btnSecondary, "w-full justify-start gap-3 h-10 px-4")}>
                  <Icon name="plus" className="w-4 h-4 text-mc" />
                  <span>{t.dash.newProject}</span>
                </button>
                <button className={cx.j(cx.btnSecondary, "w-full justify-start gap-3 h-10 px-4")}>
                  <Icon name="cpu" className="w-4 h-4 text-blue" />
                  <span>{t.dash.configureProvider}</span>
                </button>
                <button className={cx.j(cx.btnSecondary, "w-full justify-start gap-3 h-10 px-4")}>
                  <Icon name="github" className="w-4 h-4 text-tx2" />
                  <span>{t.dash.viewGitHub}</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  window.MCFL.Dashboard = Dashboard;
})();
