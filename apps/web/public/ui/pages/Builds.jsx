// Builds — master/detail layout: project picker + build history + live log
window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useRef, useCallback } = React;
  const {
    cx, api, Icon, PageHeader, EmptyState, StatusBadge, statusVariant,
    ProjectCard, BuildLogPanel
  } = window.MCFL;

  function fmtDuration(startIso, endIso) {
    if (!startIso) return "—";
    const start = Date.parse(startIso);
    const end = endIso ? Date.parse(endIso) : Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
    const ms = Math.max(0, end - start);
    if (ms < 1000) return `${ms} ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
    return `${(ms / 60_000).toFixed(1)} min`;
  }

  function Builds({ t, project, onSelect }) {
    const [projects, setProjects] = useState([]);
    const [builds, setBuilds] = useState([]);
    const [activeBuildId, setActiveBuildId] = useState(null);
    const [lines, setLines] = useState([]);
    const [activeBuild, setActiveBuild] = useState(null);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState(null);
    const esRef = useRef(null);

    useEffect(() => {
      api.projects().then(setProjects).catch(() => setProjects([]));
    }, []);

    const loadBuilds = useCallback(() => {
      if (!project) { setBuilds([]); return; }
      api.builds(project.id).then((list) => {
        setBuilds(list || []);
        if (!activeBuildId && list && list.length > 0) {
          setActiveBuildId(list[0].buildId);
        }
      }).catch(() => setBuilds([]));
    }, [project, activeBuildId]);

    useEffect(loadBuilds, [project && project.id]);

    // Close SSE on unmount or project change.
    useEffect(() => {
      return () => { if (esRef.current) { esRef.current.close(); esRef.current = null; } };
    }, []);

    // (Re)subscribe to active build SSE when activeBuildId changes.
    useEffect(() => {
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      setLines([]);
      setActiveBuild(null);
      if (!project || !activeBuildId) return;

      // First fetch snapshot (lines + status), then attach SSE for live tail.
      api.build(project.id, activeBuildId)
        .then((snap) => {
          setActiveBuild(snap);
          setLines(snap.lines || []);
          // If already finished, don't stream.
          if (snap.status === "running" || snap.status === "queued") {
            esRef.current = api.streamBuild(project.id, activeBuildId, (ev) => {
              if (ev.type === "log" && typeof ev.line === "string") {
                setLines((prev) => prev.concat(ev.line));
              } else if (ev.type === "status") {
                setActiveBuild((prev) => prev ? { ...prev, status: ev.status, errorSummary: ev.errorSummary, finishedAt: ev.finishedAt } : prev);
              } else if (ev.type === "done") {
                if (esRef.current) { esRef.current.close(); esRef.current = null; }
                loadBuilds();
              }
            });
          }
        })
        .catch((err) => setError(err.message || String(err)));
    }, [project && project.id, activeBuildId, loadBuilds]);

    const startBuild = async () => {
      if (!project || starting) return;
      setStarting(true);
      setError(null);
      try {
        const created = await api.startBuild(project.id);
        setActiveBuildId(created.buildId);
        loadBuilds();
      } catch (err) {
        if (err.status === 409) {
          setError(t.build.conflict);
        } else {
          setError(err.message || String(err));
        }
      } finally {
        setStarting(false);
      }
    };

    const cancelBuild = async () => {
      if (!project || !activeBuildId) return;
      if (!window.confirm(t.build.cancelBuildConfirm)) return;
      try {
        await api.cancelBuild(project.id, activeBuildId);
        loadBuilds();
      } catch (err) {
        setError(err.message || String(err));
      }
    };

    const isRunning = activeBuild && (activeBuild.status === "running" || activeBuild.status === "queued");

    const getStatusLabel = (status) => {
      if (status === "interrupted") return t.build.interrupted;
      return t.build[status] || status;
    };

    const getStatusVariant = (status) => {
      if (status === "interrupted") return "warn";
      return statusVariant(status);
    };

    return (
      <div className="p-6 max-w-[1700px] mx-auto">
        <PageHeader
          title={t.build.title}
          subtitle={t.build.subtitle}
          actions={
            project ? (
              <button
                data-testid="start-build-btn"
                onClick={startBuild}
                disabled={starting || isRunning}
                className={cx.btnPrimary}
              >
                <Icon name="play" className="w-3.5 h-3.5" />
                {starting ? t.build.starting : t.build.startBuild}
              </button>
            ) : null
          }
        />

        {error && (
          <div className="mb-3 text-xs text-danger bg-danger/5 border border-danger/30 rounded-md px-3 py-2 flex items-start gap-2">
            <Icon name="info" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[260px_300px_1fr] gap-3 min-h-0">
          {/* Project picker */}
          <aside className="min-w-0">
            <div className={cx.sectionTitle}>Projects</div>
            {projects.length === 0 ? (
              <EmptyState icon="folder" title={t.dash.noProjects} variant="early-dev" />
            ) : (
              <div className="space-y-1.5">
                {projects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onSelect={(prj) => { setActiveBuildId(null); onSelect && onSelect(prj); }}
                    selected={project && project.id === p.id}
                  />
                ))}
              </div>
            )}
          </aside>

          {/* Build history */}
          <aside className="min-w-0">
            <div className={cx.sectionTitle}>{t.build.historyTitle}</div>
            {!project ? (
              <EmptyState icon="terminal" title={t.build.pickProject} />
            ) : builds.length === 0 ? (
              <EmptyState icon="terminal" title={t.build.noBuilds} />
            ) : (
              <div className={cx.j(cx.card, "divide-y divide-border")}>
                {builds.map((b) => (
                  <button
                    key={b.buildId}
                    type="button"
                    onClick={() => setActiveBuildId(b.buildId)}
                    className={cx.j(
                      "w-full text-left px-3 py-2 hover:bg-elevated/60 transition-colors",
                      activeBuildId === b.buildId ? "bg-elevated" : ""
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <StatusBadge variant={getStatusVariant(b.status)} label={getStatusLabel(b.status)} />
                      <span className={cx.j("text-2xs text-tx3 ml-auto", cx.mono)}>
                        {fmtDuration(b.startedAt, b.finishedAt)}
                      </span>
                    </div>
                    <div className={cx.j("text-2xs text-tx2 mt-1", cx.mono)}>
                      {(b.startedAt || "").slice(0, 19).replace("T", " ")}
                    </div>
                    {b.errorSummary && (
                      <div className="text-2xs text-danger mt-1 truncate">{b.errorSummary.split("\n")[0]}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <p className="text-2xs text-tx3 mt-2 flex items-start gap-1.5">
              <Icon name="info" className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{t.build.ephemeralNote}</span>
            </p>
          </aside>

          {/* Detail */}
          <section className="min-w-0 space-y-3">
            {activeBuild ? (
              <>
                <div className={cx.j(cx.card, "px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2")}>
                  <StatusBadge data-testid="build-status" variant={getStatusVariant(activeBuild.status)} label={getStatusLabel(activeBuild.status)} />
                  {isRunning && (
                    <button data-testid="cancel-build-btn" onClick={cancelBuild} className={cx.btnSecondary}>
                      <Icon name="close" className="w-3.5 h-3.5" />
                      {t.build.cancelBuild}
                    </button>
                  )}
                  <span className="text-2xs text-tx2 uppercase tracking-wider">{t.build.startedAt}:</span>
                  <span className={cx.j("text-2xs text-tx1", cx.mono)}>{(activeBuild.startedAt || "").slice(0, 19).replace("T", " ")}</span>
                  <span className="text-2xs text-tx2 uppercase tracking-wider">{t.build.duration}:</span>
                  <span className={cx.j("text-2xs text-tx1", cx.mono)}>{fmtDuration(activeBuild.startedAt, activeBuild.finishedAt)}</span>
                  <span className="text-2xs text-tx2 uppercase tracking-wider">{t.build.lines}:</span>
                  <span className={cx.j("text-2xs text-tx1", cx.mono)}>{lines.length}</span>
                </div>

                {activeBuild.errorSummary && (
                  <div className={cx.j(cx.card, "px-3 py-2.5 border-danger/40")}>
                    <div className="text-2xs uppercase tracking-wider text-danger font-semibold mb-1">{t.build.errorSummary}</div>
                    <pre className={cx.j("text-2xs text-danger whitespace-pre-wrap", cx.mono)}>{activeBuild.errorSummary}</pre>
                  </div>
                )}

                <BuildLogPanel lines={lines} title={`build-${activeBuild.buildId.slice(0, 8)}.log`} emptyText={t.build.noLogs} t={t} />
              </>
            ) : project ? (
              <EmptyState icon="terminal" title={t.build.noBuilds} description={t.build.ephemeralNote} />
            ) : (
              <EmptyState icon="terminal" title={t.build.pickProject} />
            )}
          </section>
        </div>
      </div>
    );
  }

  window.MCFL.Builds = Builds;
})();
