// Builds — placeholder until build orchestrator wires streaming logs
window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, PageHeader, EmptyState, StatusBadge, statusVariant, BuildLogPanel } = window.MCFL;

  function Builds({ t }) {
    const [runs, setRuns] = useState(null);

    useEffect(() => {
      api.workflowRuns().then(setRuns).catch(() => setRuns([]));
    }, []);

    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <PageHeader
          title={t.build.title}
          subtitle={t.build.subtitle}
          badge={<StatusBadge variant="planned" label={t.planned} />}
        />

        <EmptyState
          icon="terminal"
          title={t.planned}
          description={t.build.placeholderNotice}
          variant="planned"
        />

        <div className="mt-6">
          <div className={cx.sectionTitle}>{t.wf.recentRuns}</div>
          {runs === null ? (
            <div className={cx.j(cx.card, "px-4 py-8 text-center text-tx3 text-sm")}>{t.common.loading}…</div>
          ) : runs.length === 0 ? (
            <EmptyState icon="terminal" title={t.wf.noRuns} variant="early-dev" />
          ) : (
            <div className={cx.j(cx.card, "divide-y divide-border")}>
              {runs.slice(0, 12).map((r) => (
                <div key={r.id} className="px-3 py-2 flex items-center gap-3">
                  <StatusBadge variant={statusVariant(r.status)} label={r.status || "pending"} />
                  <span className={cx.j("text-sm text-tx1 truncate flex-1", cx.mono)}>
                    {r.workflow_id || r.id}
                  </span>
                  <span className={cx.j("text-2xs text-tx3", cx.mono)}>
                    {(r.started_at || "").slice(0, 19).replace("T", " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <div className={cx.sectionTitle}>{t.build.logs}</div>
          <BuildLogPanel
            lines={[]}
            emptyText={t.build.noLogs}
            title="streaming.log"
          />
        </div>
      </div>
    );
  }

  window.MCFL.Builds = Builds;
})();
