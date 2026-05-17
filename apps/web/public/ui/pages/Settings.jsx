// Settings — provider CRUD + appearance preferences
window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useCallback } = React;
  const { cx, api, PageHeader, EmptyState, StatusBadge, Icon, ProviderForm } = window.MCFL;

  function Section({ title, badge, children }) {
    return (
      <section className={cx.j(cx.card, "px-4 py-3.5")}>
        <header className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-tx1">{title}</h2>
          {badge}
        </header>
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

  function Settings({ t, lang, onSetLang }) {
    const [providers, setProviders] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [testResult, setTestResult] = useState(null);

    const reload = useCallback(() => {
      setError(null);
      api.providers().then(setProviders).catch(() => setProviders([]));
    }, []);

    useEffect(reload, [reload]);

    const handleSave = async (body) => {
      await api.createProvider(body);
      setShowForm(false);
      reload();
    };

    const handleToggle = async (p) => {
      try {
        await api.updateProvider(p.id, { enabled: !p.enabled });
        reload();
      } catch (err) {
        setError(err.message || String(err));
      }
    };

    const handleDelete = async (p) => {
      if (!window.confirm(t.settings.providers.confirmDelete)) return;
      try {
        await api.deleteProvider(p.id);
        reload();
      } catch (err) {
        setError(err.message || String(err));
      }
    };

    const handleTest = async (p) => {
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

    const tf = t.settings.providers;

    return (
      <div className="p-6 max-w-[1100px] mx-auto">
        <PageHeader
          title={t.settings.title}
          subtitle={t.settings.subtitle}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Provider section — full functionality */}
          <Section
            title={t.settings.groups.provider}
            badge={
              providers === null
                ? null
                : <StatusBadge variant={providers.length > 0 ? "success" : "warn"} label={providers.length > 0 ? `${providers.length}` : "none"} dot={false} />
            }
          >
            {error && (
              <div className="mb-2 text-xs text-danger bg-danger/5 border border-danger/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            {testResult && (
              <div className={cx.j(
                "mb-2 text-xs px-3 py-2 rounded-md border",
                testResult.ok ? "text-mc bg-mc/5 border-mc/30" : "text-danger bg-danger/5 border-danger/30"
              )}>
                {testResult.message}
              </div>
            )}
            {providers === null ? (
              <span className="text-tx3">{t.common.loading}…</span>
            ) : providers.length === 0 && !showForm ? (
              <EmptyState
                icon="cpu"
                title={tf.empty}
                action={
                  <button onClick={() => setShowForm(true)} className={cx.btnPrimary}>
                    <Icon name="plus" className="w-3.5 h-3.5" />
                    {tf.add}
                  </button>
                }
              />
            ) : (
              <div className="space-y-2">
                {!showForm && (
                  <div className="flex justify-end">
                    <button onClick={() => setShowForm(true)} className={cx.btnPrimary}>
                      <Icon name="plus" className="w-3.5 h-3.5" />
                      {tf.add}
                    </button>
                  </div>
                )}
                {showForm && (
                  <ProviderForm
                    t={t}
                    mode="create"
                    onSave={handleSave}
                    onCancel={() => setShowForm(false)}
                  />
                )}
                {providers.length > 0 && (
                  <div className={cx.j(cx.card, "divide-y divide-border md:col-span-2")}>
                    {providers.map((p) => (
                      <ProviderRow
                        key={p.id}
                        p={p}
                        t={t}
                        busy={busy}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        onTest={handleTest}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title={t.settings.groups.models} badge={<StatusBadge variant="planned" label={t.planned} />}>
            Model profile editor will be wired with the workflow runtime.
          </Section>
          <Section title={t.settings.groups.toolchains} badge={<StatusBadge variant="success" label="wired" dot={false} />}>
            JDK detection is live — see the Toolchains page. Install/uninstall is CLI-only for now.
          </Section>
          <Section title={t.settings.groups.workspace} badge={<StatusBadge variant="planned" label={t.planned} />}>
            Workspace path, project quota, artifact retention.
          </Section>
          <Section title={t.settings.groups.security} badge={<StatusBadge variant="planned" label={t.planned} />}>
            Basic auth admin credentials are read from environment for now.
          </Section>
          <Section title={t.settings.groups.proxy} badge={<StatusBadge variant="planned" label={t.planned} />}>
            HTTP/HTTPS proxy for AI Provider requests.
          </Section>

          <Section title={t.settings.groups.appearance}>
            <div className="flex items-center justify-between">
              <span>{t.settings.language}</span>
              <div className="flex items-center gap-1">
                {["zh", "en"].map((l) => (
                  <button key={l} type="button" onClick={() => onSetLang(l)} className={lang === l ? cx.chipActive : cx.chipNeutral}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>{t.settings.theme}</span>
              <StatusBadge variant="neutral" label={t.settings.dark} dot={false} />
            </div>
          </Section>
        </div>
      </div>
    );
  }

  window.MCFL.Settings = Settings;
})();
