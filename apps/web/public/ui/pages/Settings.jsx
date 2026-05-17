// Settings — provider / models / toolchains / workspace / security / proxy / appearance
window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, PageHeader, EmptyState, StatusBadge, Icon } = window.MCFL;

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

  function Settings({ t, lang, onSetLang }) {
    const [providers, setProviders] = useState(null);

    useEffect(() => {
      api.providers().then(setProviders).catch(() => setProviders([]));
    }, []);

    return (
      <div className="p-6 max-w-[1100px] mx-auto">
        <PageHeader
          title={t.settings.title}
          subtitle={t.settings.subtitle}
          badge={<StatusBadge variant="warn" label={t.earlyDev} />}
        />

        <div className="mb-4 text-xs text-tx2 bg-elevated/40 border border-border rounded-md px-3 py-2 flex items-start gap-2">
          <Icon name="info" className="w-4 h-4 mt-0.5 text-tx3 shrink-0" />
          <span>{t.settings.placeholderNotice}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Section
            title={t.settings.groups.provider}
            badge={
              providers === null
                ? null
                : <StatusBadge
                    variant={providers.length > 0 ? "success" : "warn"}
                    label={providers.length > 0 ? `${providers.length} configured` : "none"}
                  />
            }
          >
            {providers === null ? (
              <span className="text-tx3">{t.common.loading}…</span>
            ) : providers.length === 0 ? (
              <span>No providers registered. CLI: <code className={cx.mono}>mcfl provider add ...</code></span>
            ) : (
              <ul className="space-y-1">
                {providers.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span className={cx.mono}>{p.display_name} <span className="text-tx3">({p.type})</span></span>
                    <StatusBadge variant={p.enabled ? "success" : "neutral"} label={p.enabled ? "enabled" : "off"} dot={false} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={t.settings.groups.models} badge={<StatusBadge variant="planned" label={t.planned} />}>
            Model profile editor will be wired with the workflow runtime.
          </Section>
          <Section title={t.settings.groups.toolchains} badge={<StatusBadge variant="planned" label={t.planned} />}>
            JDK / Gradle / Maven path overrides.
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
                  <button
                    key={l}
                    type="button"
                    onClick={() => onSetLang(l)}
                    className={lang === l ? cx.chipActive : cx.chipNeutral}
                  >
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
