window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, PageHeader, EmptyState, ProjectCard, Icon, MCVersionPicker, CustomSelect } = window.MCFL;

  function Projects({ t, onSelectProject, newProjectIntent, onConsumeNewProjectIntent }) {
    const [projects, setProjects] = useState([]);
    const [targets, setTargets] = useState([]);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(true);

    // Form state
    const [form, setForm] = useState({ name: '', target: '', mcVersion: '', packageName: 'com.example.plugin' });
    const [busy, setBusy] = useState(false);

    const reload = () => {
      setLoading(true);
      api.projects().then(setProjects).finally(() => setLoading(false));
      api.targets().then(setTargets).catch(() => {});
    };

    useEffect(reload, []);

    // Honour the Dashboard "Quick start → New project" shortcut: when the
    // parent signals an intent, auto-open the form and clear the flag.
    useEffect(() => {
      if (newProjectIntent) {
        setShowNew(true);
        onConsumeNewProjectIntent && onConsumeNewProjectIntent();
      }
    }, [newProjectIntent, onConsumeNewProjectIntent]);

    const handleCreate = async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        await api.createProject({
          name: form.name,
          targetId: form.target,
          minecraftVersion: form.mcVersion,
          packageName: form.packageName,
        });
        setShowNew(false);
        setForm({ name: '', target: '', mcVersion: '', packageName: 'com.example.plugin' });
        reload();
      } catch (err) {
        alert(err.message);
      } finally {
        setBusy(false);
      }
    };

    const handleDelete = async (project) => {
      if (!window.confirm(t.proj.confirmDelete)) return;
      try {
        await api.deleteProject(project.id);
        if (onSelectProject) onSelectProject(null);
        reload();
      } catch (err) {
        alert(err.message);
      }
    };

    const handleTargetChange = (val) => {
      // Don't reset mcVersion when the user changes target. The picker
      // now uses a universal version list, so a previously-picked
      // version stays valid across target changes.
      setForm(f => ({ ...f, target: val }));
    };

    return (
      <div className="p-6 max-w-[1200px] mx-auto space-y-6">
        <PageHeader
          title={t.proj.title}
          subtitle={t.proj.subtitle}
          actions={
            <button data-testid="new-project-btn" onClick={() => setShowNew(true)} className={cx.btnPrimary}>
              <Icon name="plus" className="w-4 h-4" />
              {t.proj.newProject}
            </button>
          }
        />

        {showNew && (
          <form onSubmit={handleCreate} className={cx.j(cx.card, "p-6 space-y-4 max-w-2xl mx-auto shadow-xl")}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-tx1">{t.proj.newProject}</h2>
              <button data-testid="close-project-form" type="button" onClick={() => setShowNew(false)} className={cx.btnIcon}><Icon name="close" /></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={cx.label}>{t.proj.name}</label>
                <input data-testid="project-name" required className={cx.input} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="MyAwesomePlugin" />
              </div>
              <div className="space-y-1.5">
                <label className={cx.label}>{t.proj.packageName}</label>
                <input data-testid="project-packageName" required className={cx.input} value={form.packageName} onChange={e => setForm(f => ({...f, packageName: e.target.value}))} />
              </div>
              <div className="space-y-1.5">
                <label className={cx.label}>{t.proj.target}</label>
                <CustomSelect
                  data-testid="project-targetId"
                  value={form.target}
                  onChange={handleTargetChange}
                  placeholder="— Select Target —"
                  options={targets.map(tg => ({ value: tg.id, label: tg.displayName || tg.name || tg.id }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className={cx.label}>{t.proj.mcVersion}</label>
                <MCVersionPicker 
                  t={t}
                  targetId={form.target} 
                  value={form.mcVersion} 
                  onChange={val => setForm(f => ({...f, mcVersion: val}))} 
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button type="button" onClick={() => setShowNew(false)} className={cx.btnSecondary}>{t.proj.cancel}</button>
              <button data-testid="project-create-btn" type="submit" disabled={busy} className={cx.btnPrimary}>
                {busy ? t.proj.creating : t.proj.create}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="py-20 text-center text-tx3">{t.common.loading}...</div>
        ) : projects.length === 0 ? (
          <EmptyState icon="folder" title={t.proj.noProjects} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <ProjectCard 
                key={p.id} 
                project={p} 
                onSelect={onSelectProject} 
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  window.MCFL.Projects = Projects;
})();
