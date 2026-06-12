window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, CustomSelect, MCVersionPicker } = window.MCFL;

  /**
   * Modal for editing an existing project's name, package, target platform,
   * and Minecraft version. Calls PATCH /api/projects/:id on save and hands
   * the updated row back through onSaved.
   */
  function ProjectEditModal({ t, project, onClose, onSaved }) {
    const [targets, setTargets] = useState([]);
    const [form, setForm] = useState({
      name: project?.name || '',
      target: project?.target_id || '',
      mcVersion: project?.minecraft_version || '',
      packageName: project?.package_name || ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
      api.targets().then(setTargets).catch(() => {});
    }, []);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (saving) return;
      setSaving(true);
      setError(null);
      try {
        // Omit the MC version when the picker was cleared by a target switch
        // and the user did not choose a new one — keep the stored version.
        const payload = {
          name: form.name,
          targetId: form.target,
          packageName: form.packageName
        };
        if (form.mcVersion) payload.minecraftVersion = form.mcVersion;
        const updated = await api.updateProject(project.id, payload);
        if (onSaved) onSaved(updated);
        onClose();
      } catch (err) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
        <form
          data-testid="project-edit-form"
          onSubmit={handleSubmit}
          onClick={e => e.stopPropagation()}
          className={cx.j(cx.card, "w-full max-w-lg p-5 space-y-4 shadow-2xl")}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-tx1">{t.proj.editProject}</h3>
            <button type="button" onClick={onClose} className={cx.btnIcon} aria-label={t.common.close}>
              <Icon name="plus" className="w-4 h-4 rotate-45" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={cx.label}>{t.proj.name}</label>
              <input data-testid="edit-project-name" required className={cx.input} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className={cx.label}>{t.proj.packageName}</label>
              <input data-testid="edit-project-packageName" required className={cx.input} value={form.packageName}
                onChange={e => setForm(f => ({ ...f, packageName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <label className={cx.label}>{t.proj.target}</label>
              <CustomSelect
                data-testid="edit-project-targetId"
                value={form.target}
                onChange={val => setForm(f => ({ ...f, target: val, mcVersion: '' }))}
                options={targets.map(tg => ({ value: tg.id, label: tg.displayName || tg.name || tg.id }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className={cx.label}>{t.proj.mcVersion}</label>
              <MCVersionPicker
                t={t}
                targetId={form.target}
                value={form.mcVersion}
                onChange={val => setForm(f => ({ ...f, mcVersion: val }))}
              />
            </div>
          </div>

          {error && <div className="text-danger text-xs">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" className={cx.btnSecondary} onClick={onClose}>{t.common.cancel}</button>
            <button type="submit" data-testid="edit-project-save-btn" className={cx.btnPrimary} disabled={saving}>
              {saving ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    );
  }

  window.MCFL.ProjectEditModal = ProjectEditModal;
})();
