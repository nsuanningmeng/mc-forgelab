window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, PageHeader, Icon, StatusBadge } = window.MCFL;

  function Toolchains({ t }) {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refresh = () => {
      setLoading(true);
      setError(null);
      if (!api || typeof api.toolchainsDoctor !== "function") {
        setError("api.toolchainsDoctor unavailable");
        setLoading(false);
        return;
      }
      api.toolchainsDoctor()
        .then(setResults)
        .catch((err) => setError(err && err.message ? err.message : String(err)))
        .finally(() => setLoading(false));
    };

    useEffect(refresh, []);

    const javaEntries = Array.isArray(results && results.java) ? results.java : [];
    const toolEntries = Array.isArray(results && results.tools) ? results.tools : [];

    return (
      <div className="p-6 max-w-[1000px] mx-auto space-y-6">
        <PageHeader
          title={t.tc.title}
          subtitle={t.tc.subtitle}
          actions={
            <button onClick={refresh} disabled={loading} className={cx.btnSecondary}>
              <Icon name="refresh" className={loading ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
              <span>{t.tc.refresh}</span>
            </button>
          }
        />

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-md p-3 text-xs text-danger">
            <Icon name="info" className="inline w-3.5 h-3.5 mr-2" />
            <span>{error}</span>
          </div>
        )}

        {loading && !results ? (
          <div className="py-20 text-center text-tx3">{t.tc.detecting}</div>
        ) : (
          <div className="space-y-4">
            <div className="bg-elevated border border-border rounded-md p-4 text-xs text-tx2 flex items-start gap-2">
              <Icon name="info" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue" />
              <span>{t.tc.hint}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className={cx.j(cx.card, "overflow-hidden")}>
                <div className="px-4 py-3 border-b border-border bg-elevated font-semibold text-tx1 text-sm">
                  Java Development Kits (JDK)
                </div>
                <div className="divide-y divide-border">
                  {javaEntries.length === 0 ? (
                    <div className="p-4 text-tx3 italic text-xs">{t.tc.noResults}</div>
                  ) : (
                    javaEntries.map((v, idx) => (
                      <div key={`jdk-${idx}-${v && v.version ? v.version : "x"}`} className="p-4 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-tx1 truncate">JDK {(v && v.version) || "—"}</div>
                          {v && v.path ? (
                            <div className={cx.j("text-2xs text-tx3 truncate", cx.mono)}>{v.path}</div>
                          ) : null}
                        </div>
                        <StatusBadge variant="success" label={t.tc.installed} />
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={cx.j(cx.card, "overflow-hidden")}>
                <div className="px-4 py-3 border-b border-border bg-elevated font-semibold text-tx1 text-sm">
                  Build Tools
                </div>
                <div className="divide-y divide-border">
                  {["Gradle", "Maven"].map((toolName) => {
                    const found = toolEntries.find(
                      (it) => it && typeof it.name === "string" && it.name.toLowerCase() === toolName.toLowerCase()
                    );
                    return (
                      <div key={toolName} className="p-4 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-tx1">{toolName}</div>
                          <div className="text-2xs text-tx3">
                            {found && found.version ? found.version : t.tc.missing}
                          </div>
                        </div>
                        <StatusBadge
                          variant={found ? "success" : "neutral"}
                          label={found ? t.tc.installed : t.tc.missing}
                        />
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

