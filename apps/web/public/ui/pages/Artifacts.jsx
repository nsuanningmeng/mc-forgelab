// Artifacts — list per project
window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, PageHeader, EmptyState, StatusBadge, ProjectCard, ArtifactTable } = window.MCFL;

  function Artifacts({ t, project, onSelect }) {
    const [projects, setProjects] = useState([]);
    const [artifacts, setArtifacts] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
      api.projects().then(setProjects).catch(() => setProjects([]));
    }, []);

    useEffect(() => {
      if (!project) { setArtifacts(null); return; }
      api.artifacts(project.id).then(setArtifacts).catch(() => setArtifacts([]));
    }, [project && project.id]);

    const copySha = async (sha) => {
      try {
        await navigator.clipboard.writeText(sha);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch { /* ignore */ }
    };

    const removeArtifact = async (a) => {
      if (!project) return;
      try {
        await api.deleteArtifact(project.id, a.artifactId);
        const next = await api.artifacts(project.id);
        setArtifacts(next);
      } catch { /* ignore */ }
    };

    return (
      <div className="p-6 max-w-[1500px] mx-auto">
        <PageHeader
          title={t.art.title}
          subtitle={t.art.subtitle}
          badge={copied ? <StatusBadge variant="success" label={t.common.copied} /> : null}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          <aside className={cx.j(cx.card, "p-3")}>
            <div className={cx.j(cx.sectionTitle, "opacity-70 mb-2")}>{t.common.projects}</div>
            {projects.length === 0 ? (
              <EmptyState icon="folder" title={t.dash.noProjects} variant="default" />
            ) : (
              <div className="space-y-1.5">
                {projects.map((p) => (
                  <ProjectCard key={p.id} project={p} onSelect={onSelect} selected={project && project.id === p.id} />
                ))}
              </div>
            )}
          </aside>

          <section className="min-w-0">
            {!project ? (
              <EmptyState icon="box" title={t.art.pickProject} variant="default" />
            ) : artifacts === null ? (
              <div className={cx.j(cx.card, "px-4 py-10 text-center text-tx3 text-sm")}>{t.common.loading}…</div>
            ) : artifacts.length === 0 ? (
              <EmptyState icon="box" title={t.art.noArtifacts} variant="default" />
            ) : (
              <ArtifactTable
                artifacts={artifacts}
                projectId={project.id}
                onCopySha={copySha}
                onDelete={removeArtifact}
                t={t.art}
              />
            )}
          </section>
        </div>
      </div>
    );
  }

  window.MCFL.Artifacts = Artifacts;
})();
