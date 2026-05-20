window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, CustomSelect } = window.MCFL;

  function ModelProfileForm({ t, providers, initial, onSave, onCancel }) {
    const tf = t.settings.profiles;
    const [form, setForm] = useState(initial || {
      name: "",
      role: "codeModel",
      providerId: providers[0]?.id || "",
      model: "",
      temperature: 0.2,
      maxTokens: 4096,
      topP: 1.0,
      timeoutMs: 60000,
      systemPrompt: "",
      enabled: true
    });

    const [availableModels, setAvailableModels] = useState([]);
    const [fetching, setFetching] = useState(false);
    const [fetchError, setFetchError] = useState(false);

    useEffect(() => {
      if (!form.providerId) {
        setAvailableModels([]);
        return;
      }
      setFetching(true);
      setFetchError(false);
      api.providerModels(form.providerId)
        .then(models => setAvailableModels(Array.isArray(models) ? models : []))
        .catch(() => setFetchError(true))
        .finally(() => setFetching(false));
    }, [form.providerId]);

    const handleSubmit = (e) => {
      e.preventDefault();
      onSave(form);
    };

    const noProviders = !providers || providers.length === 0;

    return (
      <form onSubmit={handleSubmit} className={cx.j(cx.card, "p-4 space-y-4 bg-elevated/40")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={cx.label}>{tf.fields.name}</label>
            <input 
              required 
              data-testid="profile-name"
              className={cx.input} 
              value={form.name} 
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
              placeholder="e.g. Fast Coding"
            />
          </div>

          <div className="space-y-1.5">
            <label className={cx.label}>{tf.fields.role}</label>
            <CustomSelect
              data-testid="profile-role"
              value={form.role}
              onChange={val => setForm(f => ({ ...f, role: val }))}
              options={Object.entries(tf.roleOptions).map(([val, label]) => ({ value: val, label }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className={cx.label}>{tf.fields.provider}</label>
            {noProviders ? (
              <div className="text-2xs text-danger py-2 italic">No providers configured</div>
            ) : (
              <CustomSelect
                data-testid="profile-providerId"
                value={form.providerId}
                onChange={val => setForm(f => ({ ...f, providerId: val }))}
                options={providers.map(p => ({ value: p.id, label: p.displayName }))}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className={cx.label}>{tf.fields.model}</label>
            <div className="relative">
              <input 
                required 
                data-testid="profile-model"
                list="model-list"
                className={cx.input} 
                value={form.model} 
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))} 
                placeholder={tf.modelHint}
              />
              <datalist id="model-list">
                {availableModels.map(m => <option key={m} value={m} />)}
              </datalist>
              {fetching && <div className="absolute right-2 top-2 text-2xs text-tx3">{tf.fetchingModels}</div>}
              {fetchError && <div className="absolute right-2 top-2 text-2xs text-danger">{tf.modelFetchFailed}</div>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={cx.label}>{tf.fields.temperature} (0 - 2.0)</label>
            <input 
              type="number" step="0.1" min="0" max="2" 
              className={cx.input} 
              value={form.temperature} 
              onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))} 
            />
          </div>

          <div className="space-y-1.5">
            <label className={cx.label}>{tf.fields.maxTokens}</label>
            <input 
              type="number" min="1" max="200000" 
              className={cx.input} 
              value={form.maxTokens} 
              onChange={e => setForm(f => ({ ...f, maxTokens: parseInt(e.target.value) }))} 
            />
          </div>

          <div className="space-y-1.5">
            <label className={cx.label}>{tf.fields.topP} (0 - 1.0)</label>
            <input 
              type="number" step="0.05" min="0" max="1" 
              className={cx.input} 
              value={form.topP} 
              onChange={e => setForm(f => ({ ...f, topP: parseFloat(e.target.value) }))} 
            />
          </div>

          <div className="space-y-1.5">
            <label className={cx.label}>{tf.fields.timeoutMs}</label>
            <input 
              type="number" min="1000" max="600000" 
              className={cx.input} 
              value={form.timeoutMs} 
              onChange={e => setForm(f => ({ ...f, timeoutMs: parseInt(e.target.value) }))} 
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={cx.label}>{tf.fields.systemPrompt}</label>
          <textarea 
            className={cx.j(cx.input, "h-20 py-2 resize-none")} 
            value={form.systemPrompt} 
            onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onCancel} className={cx.btnSecondary}>{t.common.cancel}</button>
          <button data-testid="profile-save-btn" type="submit" disabled={noProviders} className={cx.btnPrimary}>
            <Icon name="check" className="w-3.5 h-3.5" />
            {t.common.save}
          </button>
        </div>
      </form>
    );
  }

  window.MCFL.ModelProfileForm = ModelProfileForm;
})();
