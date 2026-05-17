// Toolchains — live JDK detection via /api/toolchains/doctor
window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useCallback } = React;
  const { cx, api, Icon, PageHeader, EmptyState, StatusBadge } = window.MCFL;

  // Group doctor results by Java version (doctor() returns one entry per version)
  const JAVA_VERSIONS = [8, 11, 17, 21];

  function Toolchains({ t }) {
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const reload = useCallback(() => {
      setLoading(true);
      setError(null);
      api.toolchainsDoctor()
        .then((res) => setResults((res && res.results) || []))
        .catch((err) => setError(err.message || String(err)))
        .finally(() => setLoading(false));
    }, []);

    useEffect(reload, [reload]);

    // The current doctor() implementation only checks Java. Build version -> status map.
    const versionMap = new Map();
    if (Array.isArray(results)) {
      let i = 0;
      for (const v of JAVA_VERSIONS) {
        versionMap.set(v, results[i] || null);
        i += 1;
      }
    }

    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <PageHeader
          title={t.tc.title}
          subtitle={t.tc.subtitle}
          actions={
            <button onClick={reload} disabled={loading} className={cx.btnSecondary}>
              <Icon name="refresh" className="w-3.5 h-3.5" />
              {loading ? t.tc.detecting : t.tc.refresh}
            </button>
          }
        />

        {error && (
          <div className="mb-4 text-xs text-danger bg-danger/5 border border-danger/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {JAVA_VERSIONS.map((v) => {
            const r = versionMap.get(v);
            const installed = r && r.installed;
            return (
              <div key={v} className={cx.j(cx.card, "px-4 py-3.5")}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-tx1">Java {v}</span>
                  <StatusBadge
                    variant={installed ? "success" : "warn"}
                    label={installed ? t.tc.installed : t.tc.missing}
                  />
                </div>
                <div className="text-2xs text-tx2 mb-1">{t.tc.versionLabel}</div>
                <div className={cx.j("text-xs text-tx1 break-all min-h-[1.2em]", cx.mono)}>
                  {r && r.version ? r.version : <span className="text-tx3">—</span>}
                </div>
                {r && r.issues && r.issues.length > 0 && (
                  <div className="mt-2">
                    <div className="text-2xs text-tx2 mb-1">{t.tc.issues}</div>
                    <ul className="text-2xs text-warn space-y-0.5 list-disc list-inside">
                      {r.issues.map((iss, idx) => (
                        <li key={idx} className="break-words">{iss}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <p className="mt-4 text-2xs text-tx3 flex items-start gap-2">
          <Icon name="info" className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{t.tc.hint}</span>
        </p>

        {results !== null && results.length === 0 && (
          <div className="mt-6">
            <EmptyState icon="wrench" title={t.tc.noResults} />
          </div>
        )}
      </div>
    );
  }

  window.MCFL.Toolchains = Toolchains;
})();
