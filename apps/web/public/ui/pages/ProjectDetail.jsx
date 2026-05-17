window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, StatusBadge, ArtifactTable } = window.MCFL;

  function ProjectDetail({ t, project: initialProject, onBack, onSelectWorkspace, lang }) {
    const [project, setProject] = useState(initialProject);
    const [builds, setBuilds] = useState([]);
    const [artifacts, setArtifacts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      setLoading(true);
      Promise.all([
        api.project(initialProject.id),
        api.builds(initialProject.id).catch(() => []),
        api.artifacts(initialProject.id).catch(() => [])
      ]).then(([p, b, a]) => {
        setProject(p);
        setBuilds(b.slice(0, 5));
        setArtifacts(a.slice(0, 5));
      }).finally(() => setLoading(false));
    }, [initialProject.id]);

    const warnings = lang === 'zh' ? project.warningsZh : project.warningsEn;

    return (
      <div className="p-6 max-w-[1200px] mx-auto space-y-6">
        <header className="flex items-center justify-between sticky top-0 bg-bg/80 backdrop-blur-md py-4 z-10 border-b border-border/50">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className={cx.btnIcon}>
              <Icon name="back" className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-tx1">{project.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge variant="info" label={project.target} dot={false} />
                <span className="text-xs text-tx3">{project.packageName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onSelectWorkspace(project)} className={cx.btnPrimary}>
              <Icon name="spark" className="w-4 h-4" />
              {t.proj.openWorkspace}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: t.proj.mcVersion, val: project.mcVersion },
                { label: t.proj.javaVersion, val: `Java ${project.javaVersion}` },
                { label: t.proj.buildTool, val: project.buildTool },
                { label: t.proj.createdAt, val: new Date(project.createdAt).toLocaleDateString() }
              ].map(i => (
                <div key={i.label} className={cx.j(cx.card, "p-3")}>
                  <div className="text-2xs text-tx3 uppercase tracking-wider mb-1">{i.label}</div>
                  <div className="text-sm font-semibold text-tx1">{i.val}</div>
                </div>
              ))}
            </div>

            {/* Warnings */}
            {warnings && warnings.length > 0 && (
              <div className="bg-warn/5 border border-warn/30 rounded-md p-4">
                <div className="flex items-center gap-2 text-warn text-sm font-semibold mb-2">
                  <Icon name="warn" className="w-4 h-4" />
                  {t.proj.warnings}
                </div>
                <ul className="text-xs text-tx2 space-y-1.5 list-disc list-inside">
                  {warnings.map((w, idx) => <li key={idx}>{w}</li>)}
                </ul>
              </div>
            )}

            {/* Capabilities */}
            <div>
              <div className={cx.sectionTitle}>{t.proj.capabilities}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(project.capabilities || {}).map(([key, enabled]) => (
                  <div key={key} className={cx.j(cx.card, "px-3 py-2 flex items-center justify-between", !enabled && "opacity-40 grayscale")}>
                    <span className="text-2xs uppercase tracking-tighter text-tx2">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <Icon name={enabled ? "check" : "close"} className={`w-3.5 h-3.5 ${enabled ? 'text-mc' : 'text-tx3'}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div>
              <div className={cx.sectionTitle}>{t.proj.recentBuilds}</div>
              <div className={cx.j(cx.card, "divide-y divide-border overflow-hidden")}>
                {builds.length === 0 ? <div className="p-4 text-xs text-tx3 italic">{t.common.empty}</div> : builds.map(b => (
                  <div key={b.id} className="p-3 hover:bg-elevated/30 transition-colors flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-tx1 truncate">#{b.id.slice(-4)}</div>
                      <div className="text-2xs text-tx3">{new Date(b.startedAt).toLocaleString()}</div>
                    </div>
                    <StatusBadge variant={b.status === 'success' ? 'success' : 'danger'} label={b.status} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className={cx.sectionTitle}>{t.proj.recentArtifacts}</div>
              <div className={cx.j(cx.card, "divide-y divide-border overflow-hidden")}>
                {artifacts.length === 0 ? <div className="p-4 text-xs text-tx3 italic">{t.common.empty}</div> : artifacts.map(a => (
                  <div key={a.id} className="p-3 hover:bg-elevated/30 transition-colors flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-tx1 truncate">{a.fileName}</div>
                      <div className="text-2xs text-tx3">{(a.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <Icon name="download" className="w-3.5 h-3.5 text-tx3" />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  window.MCFL.ProjectDetail = ProjectDetail;
})();
