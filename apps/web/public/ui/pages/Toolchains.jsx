window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, PageHeader, Icon, StatusBadge } = window.MCFL;

  function Toolchains({ t }) {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = () => {
      setLoading(true);
      api.toolchainsDoctor().then(setResults).finally(() => setLoading(false));
    };

    useEffect(refresh, []);

    return (
      <div className="p-6 max-w-[1000px] mx-auto space-y-6">
        <PageHeader
          title={t.tc.title}
          subtitle={t.tc.subtitle}
          action={
            <button onClick={refresh} disabled={loading} className={cx.btnSecondary}>
              <Icon name="refresh" className={loading ? "animate-spin" : ""} />
              {t.tc.refresh}
            </button>
          }
        />

        {loading && !results ? (
          <div className="py-20 text-center text-tx3">{t.tc.detecting}</div>
        ) : (
          <div className="space-y-4">
            <div className="bg-elevated/30 border border-border/50 rounded-md p-4 text-xs text-tx2">
              <Icon name="info" className="inline w-3.5 h-3.5 mr-2 text-blue" />
              {t.tc.hint}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className={cx.j(cx.card, "overflow-hidden")}>
                <div className="px-4 py-3 border-b border-border bg-elevated/20 font-semibold text-tx1">
                  Java Development Kits (JDK)
                </div>
                <div className="divide-y divide-border">
                  {results?.java?.length === 0 ? (
                    <div className="p-4 text-tx3 italic">{t.tc.noResults}</div>
                  ) : (
                    results?.java?.map((v) => (
                      <div key={v.version} className="p-4 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-tx1">JDK {v.version}</div>
                          <div className="text-2xs text-tx3 font-mono">{v.path}</div>
                        </div>
                        <StatusBadge variant="success" label={t.tc.installed} />
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={cx.j(cx.card, "overflow-hidden")}>
                <div className="px-4 py-3 border-b border-border bg-elevated/20 font-semibold text-tx1">
                  Build Tools
                </div>
                <div className="divide-y divide-border">
                  {["Gradle", "Maven"].map((tool) => {
                    const found = results?.tools?.find(t => t.name.toLowerCase() === tool.toLowerCase());
                    return (
                      <div key={tool} className="p-4 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-tx1">{tool}</div>
                          <div className="text-2xs text-tx3">{found ? found.version : t.tc.missing}</div>
                        </div>
                        <StatusBadge variant={found ? "success" : "neutral"} label={found ? t.tc.installed : t.tc.missing} />
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    );
  }

  window.MCFL.Toolchains = Toolchains;
})();
