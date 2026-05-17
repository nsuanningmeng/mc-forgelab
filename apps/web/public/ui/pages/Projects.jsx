// Projects — list + create form
window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, PageHeader, EmptyState, StatusBadge, ProjectCard } = window.MCFL;

  const TARGETS = ["paper", "spigot", "purpur", "folia", "velocity", "bungeecord", "fabric", "forge", "neoforge", "quilt"];

  function Projects({ t, onSelect, selectedProject }) {
    const [projects, setProjects] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
      name: "",
      targetId: "paper",
      minecraftVersion: "1.20.1",
      packageName: "com.example.plugin",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const reload = () => {
      api.projects().then(setProjects).catch(() => setProjects([]));
    };
    useEffect(reload, []);

    const submit = async (e) => {
      e.preventDefault();
      setLoading(true); setError(null);
      try {
        const created = await api.createProject(form);
        onSelect && onSelect(created);
        setShowForm(false);
        setForm({ name: "", targetId: "paper", minecraftVersion: "1.20.1", packageName: "com.example.plugin" });
        reload();
      } catch (err) {
        setError(String(err.message || err));
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <PageHeader
          title={t.proj.title}
          subtitle={t.proj.subtitle}
          actions={
            <button onClick={() => setShowForm((v) => !v)} className={cx.btnPrimary}>
              <Icon name="plus" className="w-3.5 h-3.5" />
              {showForm ? t.proj.cancel : t.proj.newProject}
            </button>
          }
        />

        {showForm && (
          <form onSubmit={submit} className={cx.j(cx.card, "p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3")}>
            <div>
              <label className={cx.label}>{t.proj.name}</label>
              <input
                className={cx.input}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="MyPlugin"
                required
              />
            </div>
            <div>
              <label className={cx.label}>{t.proj.target}</label>
              <select
                className={cx.select}
                value={form.targetId}
                onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value }))}
              >
                {TARGETS.map((tg) => <option key={tg} value={tg}>{tg}</option>)}
              </select>
            </div>
            <div>
              <label className={cx.label}>{t.proj.mcVersion}</label>
              <input
                className={cx.input}
                value={form.minecraftVersion}
                onChange={(e) => setForm((f) => ({ ...f, minecraftVersion: e.target.value }))}
                placeholder="1.20.1"
                required
              />
            </div>
            <div>
              <label className={cx.label}>{t.proj.packageName}</label>
              <input
                className={cx.j(cx.input, cx.mono)}
                value={form.packageName}
                onChange={(e) => setForm((f) => ({ ...f, packageName: e.target.value }))}
                placeholder="com.example.plugin"
                required
              />
            </div>
            {error && (
              <div className="md:col-span-2 text-xs text-danger bg-danger/5 border border-danger/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className={cx.btnGhost}>{t.proj.cancel}</button>
              <button type="submit" disabled={loading} className={cx.btnPrimary}>
                {loading ? t.proj.creating + "…" : t.proj.create}
              </button>
            </div>
          </form>
        )}

        {projects === null ? (
          <div className={cx.j(cx.card, "px-4 py-10 text-center text-tx3 text-sm")}>{t.common.loading}…</div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon="folder"
            title={t.proj.noProjects}
            description={t.dash.noProjects}
            variant="early-dev"
            action={
              <button onClick={() => setShowForm(true)} className={cx.btnPrimary}>
                <Icon name="plus" className="w-3.5 h-3.5" />
                {t.proj.newProject}
              </button>
            }
          />
        ) : (
          <div className={cx.tableWrap}>
            <table className="w-full text-sm">
              <thead className={cx.tableHead}>
                <tr>
                  <th className={cx.tableTh}>{t.proj.name}</th>
                  <th className={cx.tableTh}>{t.proj.target}</th>
                  <th className={cx.tableTh}>{t.proj.mcVersion}</th>
                  <th className={cx.tableTh}>{t.proj.javaVersion}</th>
                  <th className={cx.tableTh}>{t.proj.buildTool}</th>
                  <th className={cx.tableTh}>{t.proj.packageName}</th>
                  <th className={cx.tableTh}>{t.proj.createdAt}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onSelect && onSelect(p)}
                    className={cx.j(
                      cx.tableRow,
                      "cursor-pointer",
                      selectedProject && selectedProject.id === p.id ? "bg-elevated/60" : ""
                    )}
                  >
                    <td className={cx.j(cx.tableTd, "font-medium")}>{p.name}</td>
                    <td className={cx.tableTd}><StatusBadge variant="neutral" label={p.target_id} dot={false} /></td>
                    <td className={cx.j(cx.tableTd, cx.mono, "text-tx2")}>{p.minecraft_version}</td>
                    <td className={cx.j(cx.tableTd, cx.mono, "text-tx2")}>{p.java_version}</td>
                    <td className={cx.j(cx.tableTd, cx.mono, "text-tx2")}>{p.build_tool}</td>
                    <td className={cx.j(cx.tableTd, cx.mono, "text-tx3 text-2xs")}>{p.package_name}</td>
                    <td className={cx.j(cx.tableTd, cx.mono, "text-2xs text-tx2")}>{(p.created_at || "").slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  window.MCFL.Projects = Projects;
})();
