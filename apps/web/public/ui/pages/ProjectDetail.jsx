window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, StatusBadge, ArtifactTable, MCVersionPicker, CustomSelect } = window.MCFL;

  function ProjectDetail({ t, project: initialProject, onBack, onSelectWorkspace, lang }) {
    const [project, setProject] = useState(initialProject);
    const [builds, setBuilds] = useState([]);
    const [artifacts, setArtifacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [targets, setTargets] = useState([]);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', target: '', mcVersion: '', packageName: '' });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

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
      api.targets().then(setTargets).catch(() => {});
    }, [initialProject.id]);

    const startEdit = () => {
      const cur = project || {};
      setEditForm({
        name: cur.name || '',
        target: cur.target_id || '',
        mcVersion: cur.minecraft_version || '',
        packageName: cur.package_name || ''
      });
      setSaveError(null);
      setEditing(true);
    };

    const saveEdit = async (e) => {
      e.preventDefault();
      setSaving(true);
      setSaveError(null);
      try {
        // Omit the MC version when the picker was cleared by a target switch
        // and the user did not choose a new one — keep the stored version.
        const payload = {
          name: editForm.name,
          targetId: editForm.target,
          packageName: editForm.packageName
        };
        if (editForm.mcVersion) payload.minecraftVersion = editForm.mcVersion;
        const updated = await api.updateProject(initialProject.id, payload);
        setProject(updated);
        setEditing(false);
      } catch (err) {
        setSaveError(err.message);
      } finally {
        setSaving(false);
      }
    };

    // Backend GET /api/projects/:id returns SQLite rows (snake_case) augmented
    // with capabilities + warnings. The `target` key is an OBJECT (capabilities
    // payload), not the target id — never bind it directly to a string label.
    const p = project || {};
    const fields = {
      name: p.name || "—",
      target: p.target_id || "—",
      packageName: p.packageName || p.package_name || "",
      mcVersion: p.mcVersion || p.minecraft_version || "—",
      javaVersion: p.javaVersion || p.java_version || "",
      buildTool: p.buildTool || p.build_tool || "—",
      createdAt: p.createdAt || p.created_at || "",
      capabilities: (p.target && typeof p.target === "object" && p.target.capabilities) || p.capabilities || {},
      warningsZh: Array.isArray(p.target?.warningsZh) ? p.target.warningsZh : (Array.isArray(p.warningsZh) ? p.warningsZh : []),
      warningsEn: Array.isArray(p.target?.warningsEn) ? p.target.warningsEn : (Array.isArray(p.warningsEn) ? p.warningsEn : []),
    };
    const warnings = lang === "zh" ? fields.warningsZh : fields.warningsEn;
    const createdLabel = fields.createdAt
      ? (() => { const d = new Date(fields.createdAt); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(); })()
      : "";

    return (
      <div className="p-6 max-w-[1200px] mx-auto space-y-6">
        <header className="flex items-center justify-between sticky top-0 bg-bg/80 backdrop-blur-md py-4 z-10 border-b border-border">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className={cx.btnIcon}>
              <Icon name="chevronR" className="w-4 h-4 rotate-180" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-tx1">{fields.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge variant="info" label={fields.target} dot={false} />
                {fields.packageName && <span className="text-xs text-tx3">{fields.packageName}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button data-testid="project-edit-btn" onClick={startEdit} className={cx.btnSecondary}>
              {t.common.edit}
            </button>
            <button onClick={() => onSelectWorkspace && onSelectWorkspace(project)} className={cx.btnPrimary}>
              <Icon name="spark" className="w-4 h-4" />
              {t.proj.openWorkspace}
            </button>
          </div>
        </header>

        {editing && (
          <form onSubmit={saveEdit} className={cx.j(cx.card, "p-4 space-y-4")} data-testid="project-edit-form">
            <div className="text-sm font-semibold text-tx1">{t.proj.editProject}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={cx.label}>{t.proj.name}</label>
                <input data-testid="edit-project-name" required className={cx.input} value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className={cx.label}>{t.proj.packageName}</label>
                <input data-testid="edit-project-packageName" required className={cx.input} value={editForm.packageName}
                  onChange={e => setEditForm(f => ({ ...f, packageName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className={cx.label}>{t.proj.target}</label>
                <CustomSelect
                  data-testid="edit-project-targetId"
                  value={editForm.target}
                  onChange={val => setEditForm(f => ({ ...f, target: val, mcVersion: '' }))}
                  options={targets.map(tg => ({ value: tg.id, label: tg.displayName || tg.name || tg.id }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className={cx.label}>{t.proj.mcVersion}</label>
                <MCVersionPicker
                  t={t}
                  targetId={editForm.target}
                  value={editForm.mcVersion}
                  onChange={val => setEditForm(f => ({ ...f, mcVersion: val }))}
                />
              </div>
            </div>
            {saveError && <div className="text-danger text-xs">{saveError}</div>}
            <div className="flex items-center gap-2 justify-end">
              <button type="button" className={cx.btnSecondary} onClick={() => setEditing(false)}>{t.proj.cancel}</button>
              <button type="submit" data-testid="edit-project-save-btn" className={cx.btnPrimary} disabled={saving}>
                {saving ? t.common.saving : t.common.save}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: t.proj.mcVersion, val: fields.mcVersion },
                { label: t.proj.javaVersion, val: fields.javaVersion ? `Java ${fields.javaVersion}` : "—" },
                { label: t.proj.buildTool, val: fields.buildTool },
                { label: t.proj.createdAt, val: createdLabel || "—" }
              ].map(i => (
                <div key={i.label} className={cx.j(cx.card, "p-3")}>
                  <div className="text-2xs text-tx3 uppercase tracking-wider mb-1">{i.label}</div>
                  <div className="text-sm font-semibold text-tx1">{i.val}</div>
                </div>
              ))}
            </div>

            {warnings.length > 0 && (
              <div className="bg-warn/10 border border-warn/30 rounded-md p-4">
                <div className="flex items-center gap-2 text-warn text-sm font-semibold mb-2">
                  <Icon name="info" className="w-4 h-4" />
                  {t.proj.warnings}
                </div>
                <ul className="text-xs text-tx2 space-y-1.5 list-disc list-inside">
                  {warnings.map((w, idx) => <li key={idx}>{String(w)}</li>)}
                </ul>
              </div>
            )}

            <div>
              <div className={cx.sectionTitle}>{t.proj.capabilities}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(fields.capabilities).map(([key, enabled]) => (
                  <div key={key} className={cx.j(cx.card, "px-3 py-2 flex items-center justify-between", !enabled && "opacity-40")}>
                    <span className="text-2xs uppercase tracking-tighter text-tx2">{key.replace(/([A-Z])/g, " $1")}</span>
                    <Icon name={enabled ? "check" : "trash"} className={enabled ? "w-3.5 h-3.5 text-mc" : "w-3.5 h-3.5 text-tx3"} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div>
              <div className={cx.sectionTitle}>{t.proj.recentBuilds}</div>
              <div className={cx.j(cx.card, "divide-y divide-border overflow-hidden")}>
                {builds.length === 0 ? (
                  <div className="p-4 text-xs text-tx3 italic">{t.common.empty}</div>
                ) : builds.map((b, idx) => {
                  const bid = String(b.buildId || b.id || "");
                  const started = b.startedAt || b.started_at;
                  const dateLabel = started
                    ? (() => { const d = new Date(started); return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(); })()
                    : "";
                  return (
                    <div key={bid || idx} className="p-3 hover:bg-elevated transition-colors flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-tx1 truncate">#{bid ? bid.slice(-6) : idx + 1}</div>
                        <div className="text-2xs text-tx3">{dateLabel}</div>
                      </div>
                      <StatusBadge variant={b.status === "success" ? "success" : b.status === "running" ? "info" : "danger"} label={b.status || "?"} />
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className={cx.sectionTitle}>{t.proj.recentArtifacts}</div>
              <div className={cx.j(cx.card, "divide-y divide-border overflow-hidden")}>
                {artifacts.length === 0 ? (
                  <div className="p-4 text-xs text-tx3 italic">{t.common.empty}</div>
                ) : artifacts.map((a, idx) => {
                  const aid = a.artifactId || a.id || idx;
                  const fileName = a.fileName || a.file_name || "—";
                  const sizeBytes = Number(a.fileSize ?? a.size ?? 0);
                  const sizeLabel = Number.isFinite(sizeBytes) && sizeBytes > 0 ? `${(sizeBytes / 1024).toFixed(1)} KB` : "";
                  return (
                    <div key={aid} className="p-3 hover:bg-elevated transition-colors flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-tx1 truncate">{fileName}</div>
                        {sizeLabel && <div className="text-2xs text-tx3">{sizeLabel}</div>}
                      </div>
                      <Icon name="download" className="w-3.5 h-3.5 text-tx3" />
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  window.MCFL.ProjectDetail = ProjectDetail;
})();
