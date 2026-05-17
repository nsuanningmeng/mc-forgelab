// Workflows — registered workflows + recent runs
window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, PageHeader, EmptyState, StatusBadge, statusVariant } = window.MCFL;

  function Workflows({ t }) {
    const [workflows, setWorkflows] = useState(null);
    const [runs, setRuns] = useState(null);

    useEffect(() => {
      api.workflows().then(setWorkflows).catch(() => setWorkflows([]));
      api.workflowRuns().then(setRuns).catch(() => setRuns([]));
    }, []);

    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <PageHeader
          title={t.wf.title}
          subtitle={t.wf.subtitle}
          badge={<StatusBadge variant="warn" label={t.earlyDev} />}
        />

        <section className="mb-6">
          <div className={cx.sectionTitle}>{t.wf.registered}</div>
          {workflows === null ? (
            <div className={cx.j(cx.card, "px-4 py-8 text-center text-tx3 text-sm")}>{t.common.loading}…</div>
          ) : workflows.length === 0 ? (
            <EmptyState icon="git" title={t.wf.noWorkflows} variant="early-dev" />
          ) : (
            <div className={cx.tableWrap}>
              <table className="w-full text-sm">
                <thead className={cx.tableHead}>
                  <tr>
                    <th className={cx.tableTh}>{t.proj.name}</th>
                    <th className={cx.tableTh}>{t.wf.mode}</th>
                    <th className={cx.tableTh}>Kind</th>
                    <th className={cx.tableTh}>{t.proj.createdAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((w) => (
                    <tr key={w.id} className={cx.tableRow}>
                      <td className={cx.j(cx.tableTd, "font-medium")}>{w.name}</td>
                      <td className={cx.tableTd}><StatusBadge variant="info" label={w.mode} dot={false} /></td>
                      <td className={cx.tableTd}>
                        <StatusBadge variant={w.builtin ? "success" : "neutral"} label={w.builtin ? t.wf.builtin : t.wf.custom} dot={false} />
                      </td>
                      <td className={cx.j(cx.tableTd, cx.mono, "text-2xs text-tx2")}>{(w.created_at || "").slice(0, 19).replace("T", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className={cx.sectionTitle}>{t.wf.recentRuns}</div>
          {runs === null ? (
            <div className={cx.j(cx.card, "px-4 py-8 text-center text-tx3 text-sm")}>{t.common.loading}…</div>
          ) : runs.length === 0 ? (
            <EmptyState icon="terminal" title={t.wf.noRuns} variant="early-dev" />
          ) : (
            <div className={cx.tableWrap}>
              <table className="w-full text-sm">
                <thead className={cx.tableHead}>
                  <tr>
                    <th className={cx.tableTh}>{t.wf.status}</th>
                    <th className={cx.tableTh}>Workflow</th>
                    <th className={cx.tableTh}>Project</th>
                    <th className={cx.tableTh}>{t.wf.startedAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className={cx.tableRow}>
                      <td className={cx.tableTd}>
                        <StatusBadge variant={statusVariant(r.status)} label={r.status || "pending"} />
                      </td>
                      <td className={cx.j(cx.tableTd, cx.mono)}>{r.workflow_id}</td>
                      <td className={cx.j(cx.tableTd, cx.mono, "text-tx2")}>{r.project_id || "—"}</td>
                      <td className={cx.j(cx.tableTd, cx.mono, "text-2xs text-tx2")}>{(r.started_at || "").slice(0, 19).replace("T", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  window.MCFL.Workflows = Workflows;
})();
