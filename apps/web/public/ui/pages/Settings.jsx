window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useCallback } = React;
  const { cx, api, PageHeader, EmptyState, StatusBadge, Icon, ProviderForm, ModelProfileForm } = window.MCFL;

  function Section({ title, description, badge, children, "data-testid": testId }) {
    return (
      <section className={cx.j(cx.card, "px-4 py-3.5")} data-testid={testId}>
        <header className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-tx1">{title}</h2>
          {badge}
        </header>
        <p className="text-xs text-tx3 mb-3 leading-relaxed">{description}</p>
        <div className="text-xs text-tx2">{children}</div>
      </section>
    );
  }

  function ProviderRow({ p, t, onToggle, onDelete, onTest, busy }) {
    const tf = t.settings.providers;
    return (
      <div className="px-3 py-2.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-tx1 truncate">{p.displayName}</span>
            <StatusBadge variant={p.enabled ? "success" : "neutral"} label={p.enabled ? "enabled" : "off"} dot={false} />
            <StatusBadge variant={p.hasKey ? "info" : "warn"} label={p.hasKey ? tf.keyStored : tf.keyEmpty} dot={false} />
          </div>
          <div className={cx.j("text-2xs text-tx3 mt-0.5 truncate", cx.mono)}>
            {p.baseUrl} · {p.defaultModel}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onTest(p)} disabled={busy === p.id} className={cx.btnGhost} title={tf.test}>
            {busy === p.id ? tf.testing : tf.test}
          </button>
          <button onClick={() => onToggle(p)} className={cx.btnSecondary}>
            {p.enabled ? tf.disable : tf.enable}
          </button>
          <button onClick={() => onDelete(p)} className={cx.btnIcon} title={tf.delete}>
            <Icon name="trash" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  function ModelProfileRow({ row, providers, t, onDelete }) {
    const tf = t.settings.profiles;
    const provider = providers.find(p => p.id === row.providerId);
    return (
      <div className="px-3 py-2.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-tx1 truncate">{row.name}</span>
            <StatusBadge variant="info" label={tf.roleOptions[row.role] || row.role} dot={false} />
          </div>
          <div className={cx.j("text-2xs text-tx3 mt-0.5 truncate", cx.mono)}>
            {provider?.displayName || row.providerId} · {row.model} · T:{row.temperature}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button data-testid="delete-profile-btn" onClick={() => onDelete(row)} className={cx.btnIcon} title={tf.delete}>
            <Icon name="trash" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  function Settings({ t, lang, onSetLang, onSetTheme, theme }) {
    const [providers, setProviders] = useState(null);
    const [profiles, setProfiles] = useState(null);
    const [showProviderForm, setShowProviderForm] = useState(false);
    const [showProfileForm, setShowProfileForm] = useState(false);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [testResult, setTestResult] = useState(null);

    const reload = useCallback(() => {
      setError(null);
      api.providers().then(setProviders).catch(() => setProviders([]));
      api.modelProfiles().then(setProfiles).catch(() => setProfiles([]));
    }, []);

    useEffect(reload, [reload]);

    const handleSaveProvider = async (body) => {
      await api.createProvider(body);
      setShowProviderForm(false);
      reload();
    };

    const handleSaveProfile = async (body) => {
      await api.createModelProfile(body);
      setShowProfileForm(false);
      reload();
    };

    const handleToggleProvider = async (p) => {
      try {
        await api.updateProvider(p.id, { enabled: !p.enabled });
        reload();
      } catch (err) {
        setError(err.message || String(err));
      }
    };

    const handleDeleteProvider = async (p) => {
      if (!window.confirm(t.settings.providers.confirmDelete)) return;
      try {
        await api.deleteProvider(p.id);
        reload();
      } catch (err) {
        setError(err.message || String(err));
      }
    };

    const handleDeleteProfile = async (row) => {
      if (!window.confirm(t.settings.profiles.confirmDelete)) return;
      try {
        await api.deleteModelProfile(row.id);
        reload();
      } catch (err) {
        setError(err.message || String(err));
      }
    };

    const handleTestProvider = async (p) => {
      setBusy(p.id);
      setTestResult(null);
      setError(null);
      try {
        const r = await api.testProvider(p.id);
        const ok = !!(r && (r.ok || r.success));
        setTestResult({ id: p.id, ok, message: r && (r.message || (ok ? t.settings.providers.testOk : t.settings.providers.testFail)) });
      } catch (err) {
        setTestResult({ id: p.id, ok: false, message: err.message || String(err) });
      } finally {
        setBusy(null);
      }
    };

    const tfp = t.settings.providers;
    const tfl = t.settings.profiles;
    const desc = t.settings.descriptions;

    return (
      <div className="p-6 max-w-[1100px] mx-auto">
        <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Section title={t.settings.groups.provider} description={desc.provider} data-testid="ai-providers-section">
            {error && <div className="mb-2 text-xs text-danger bg-danger/5 border border-danger/30 rounded-md px-3 py-2">{error}</div>}
            {testResult && <div className={cx.j("mb-2 text-xs px-3 py-2 rounded-md border", testResult.ok ? "text-mc bg-mc/5 border-mc/30" : "text-danger bg-danger/5 border-danger/30")}>{testResult.message}</div>}
            
            {providers === null ? (
              <span className="text-tx3">{t.common.loading}…</span>
            ) : providers.length === 0 && !showProviderForm ? (
              <EmptyState icon="cpu" title={tfp.empty} action={<button data-testid="add-provider-btn" onClick={() => setShowProviderForm(true)} className={cx.btnPrimary}><Icon name="plus" className="w-3.5 h-3.5" />{tfp.add}</button>} />
            ) : (
              <div className="space-y-2">
                {!showProviderForm && (
                  <div className="flex justify-end"><button data-testid="add-provider-btn" onClick={() => setShowProviderForm(true)} className={cx.btnPrimary}><Icon name="plus" className="w-3.5 h-3.5" />{tfp.add}</button></div>
                )}
                {showProviderForm && <ProviderForm t={t} mode="create" onSave={handleSaveProvider} onCancel={() => setShowProviderForm(false)} />}
                {providers.length > 0 && (
                  <div className={cx.j(cx.card, "divide-y divide-border")}>
                    {providers.map(p => <ProviderRow key={p.id} p={p} t={t} busy={busy} onToggle={handleToggleProvider} onDelete={handleDeleteProvider} onTest={handleTestProvider} />)}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title={t.settings.groups.models} description={desc.models} badge={<StatusBadge variant="success" label="active" dot={false} />} data-testid="model-profiles-section">
            {profiles === null ? (
              <span className="text-tx3">{t.common.loading}…</span>
            ) : profiles.length === 0 && !showProfileForm ? (
              <EmptyState icon="box" title={tfl.empty} action={<button data-testid="add-profile-btn" onClick={() => setShowProfileForm(true)} className={cx.btnPrimary}><Icon name="plus" className="w-3.5 h-3.5" />{tfl.add}</button>} />
            ) : (
              <div className="space-y-2">
                {!showProfileForm && (
                  <div className="flex justify-end"><button data-testid="add-profile-btn" onClick={() => setShowProfileForm(true)} className={cx.btnPrimary}><Icon name="plus" className="w-3.5 h-3.5" />{tfl.add}</button></div>
                )}
                {showProfileForm && (
                  <ModelProfileForm 
                    t={t} 
                    providers={providers || []} 
                    onSave={handleSaveProfile} 
                    onCancel={() => setShowProfileForm(false)} 
                  />
                )}
                {profiles.length > 0 && (
                  <div className={cx.j(cx.card, "divide-y divide-border")}>
                    {profiles.map(row => <ModelProfileRow key={row.id} row={row} providers={providers || []} t={t} onDelete={handleDeleteProfile} />)}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title={t.settings.groups.toolchains} description={desc.toolchains} badge={<StatusBadge variant="success" label="active" dot={false} />}>
            <div className="flex items-center gap-2">
              <Icon name="check" className="text-mc w-3.5 h-3.5" />
              <span>JDK detection is live. CLI manages installs.</span>
            </div>
          </Section>

          <Section title={t.settings.groups.workspace} description={desc.workspace} badge={<StatusBadge variant="planned" label={t.planned} />}>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between"><span>Default Path</span><span className={cx.mono}>/opt/mc-forgelab</span></div>
              <div className="flex justify-between"><span>Quota</span><span>10 GB</span></div>
            </div>
          </Section>

          <Section title={t.settings.groups.security} description={desc.security}>
            <button className={cx.btnSecondary} disabled>{t.common.confirm} Rotation</button>
          </Section>

          <Section title={t.settings.groups.appearance} description={desc.appearance}>
            <div className="flex items-center justify-between mb-3">
              <span>{t.settings.language}</span>
              <div className="flex items-center gap-1">
                {["zh", "en"].map((l) => (
                  <button key={l} type="button" onClick={() => onSetLang(l)} className={lang === l ? cx.chipActive : cx.chipNeutral}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>{t.settings.theme}</span>
              <div className="flex items-center gap-1">
                <button type="button" data-testid="theme-dark" onClick={() => onSetTheme('dark')} className={theme === 'dark' ? cx.chipActive : cx.chipNeutral}>{t.settings.dark}</button>
                <button type="button" data-testid="theme-light" onClick={() => onSetTheme('light')} className={theme === 'light' ? cx.chipActive : cx.chipNeutral}>{t.settings.light}</button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    );
  }

  window.MCFL.Settings = Settings;
})();
