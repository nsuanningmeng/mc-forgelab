window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, PageHeader, EmptyState, StatusBadge, ProjectCard, PromptComposer, BuildLogPanel } = window.MCFL;

  function Workspace({ t, selectedProject, onSelectProject }) {
    const [projects, setProjects] = useState([]);
    const [logs] = useState([
      "[mc-forgelab] workspace surface online",
      "[i] live AI orchestration ready in v0.2",
      "[i] use SSE endpoint for real-time workflow streaming",
    ]);

    useEffect(() => {
      api.projects().then(setProjects).catch(() => setProjects([]));
    }, []);

    return (
      <div className="p-6 max-w-[1800px] mx-auto">
        <PageHeader
          title={t.ws.title}
          subtitle={t.ws.subtitle}
          badge={<StatusBadge variant="warn" label={t.earlyDev} />}
        />

        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_360px] gap-3">
          {/* LEFT: projects + file tree */}
          <aside className="space-y-3 min-w-0">
            <div>
              <div className={cx.sectionTitle}>{t.common.projects}</div>
              {projects.length === 0 ? (
                <EmptyState icon="folder" title={t.dash.noProjects} variant="early-dev" />
              ) : (
                <div className="space-y-1.5">
                  {projects.slice(0, 8).map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onSelect={onSelectProject}
                      selected={selectedProject && selectedProject.id === p.id}
                    />
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className={cx.sectionTitle}>{t.ws.fileTree}</div>
              <EmptyState icon="folder" title={t.planned} description="Project file tree is planned for the IDE view." variant="planned" />
            </div>
          </aside>

          {/* CENTER: prompt composer + timeline */}
          <section className="space-y-3 min-w-0">
            {!selectedProject ? (
              <EmptyState
                icon="cpu"
                title={t.ws.pickProject}
                description={t.ws.placeholderNotice}
                variant="early-dev"
              />
            ) : (
              <>
                <PromptComposer t={t} disabled={false} />
                <div>
                  <div className={cx.sectionTitle}>{t.ws.timeline}</div>
                  <EmptyState
                    icon="git"
                    title={t.planned}
                    description="Step-by-step AI orchestration timeline (plan → patch → build) is active via workflow API."
                    variant="planned"
                  />
                </div>
              </>
            )}
          </section>

          {/* RIGHT: file preview + build log */}
          <aside className="space-y-3 min-w-0">
            <div>
              <div className={cx.sectionTitle}>{t.ws.filePreview}</div>
              <div className={cx.j(cx.card, "px-3 py-8 text-center text-2xs text-tx3")}>
                {t.ws.noFile}
              </div>
            </div>
            <div>
              <div className={cx.sectionTitle}>{t.ws.buildLog}</div>
              <BuildLogPanel lines={logs} title="workspace.log" />
            </div>
          </aside>
        </div>
      </div>
    );
  }

  window.MCFL.Workspace = Workspace;
})();
