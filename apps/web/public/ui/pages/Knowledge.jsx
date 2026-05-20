window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useCallback } = React;
  const { cx, api, PageHeader, EmptyState, Icon, StatusBadge, CustomSelect } = window.MCFL;

  function KnowledgeCard({ item }) {
    const tags = Array.isArray(item && item.tags) ? item.tags : [];
    const title = (item && item.title) || (item && item.id) || "";
    const content = (item && item.content) || "";
    const priority = (item && typeof item.priority === "number") ? item.priority : 0;
    return (
      <div className={cx.j(cx.card, "p-4 hover:border-mc/40 transition-colors group")}>
        <div className="flex items-start justify-between mb-2 gap-2">
          <h3 className="text-sm font-semibold text-tx1 group-hover:text-mc transition-colors min-w-0 break-words">{title}</h3>
          {priority > 0 && priority <= 2 && <StatusBadge variant="warn" label="Hot" />}
        </div>
        <p className="text-xs text-tx2 mb-3 leading-relaxed">{content}</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={String(tag)} className="px-1.5 py-0.5 rounded bg-elevated text-tx3 text-2xs border border-border uppercase tracking-tighter">
                {String(tag)}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  function Knowledge({ t }) {
    // Backend returns { targets, mcMajors, topics }. Default to empty arrays so
    // pre-fetch render and partial responses never throw on .map().
    const [matrix, setMatrix] = useState({ targets: [], mcMajors: [], topics: [] });
    const [filters, setFilters] = useState({ target: "", mcVersion: "", topic: "", q: "" });
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
      if (!api || typeof api.knowledgeMatrix !== "function") return;
      api.knowledgeMatrix()
        .then((m) => {
          setMatrix({
            targets: Array.isArray(m && m.targets) ? m.targets : [],
            mcMajors: Array.isArray(m && m.mcMajors) ? m.mcMajors : [],
            topics: Array.isArray(m && m.topics) ? m.topics : [],
          });
        })
        .catch(() => { /* keep defaults */ });
    }, []);

    const search = useCallback(() => {
      setLoading(true);
      setError(null);
      if (!api || typeof api.knowledgeSearch !== "function") {
        setLoading(false);
        setError("api.knowledgeSearch unavailable");
        return;
      }
      api.knowledgeSearch(filters)
        .then((rows) => setResults(Array.isArray(rows) ? rows : []))
        .catch((err) => {
          setResults([]);
          setError(err && err.message ? err.message : String(err));
        })
        .finally(() => setLoading(false));
    }, [filters]);

    useEffect(() => {
      const timer = setTimeout(search, 300);
      return () => clearTimeout(timer);
    }, [search]);

    const targets = Array.isArray(matrix.targets) ? matrix.targets : [];
    const mcMajors = Array.isArray(matrix.mcMajors) ? matrix.mcMajors : [];
    const topics = Array.isArray(matrix.topics) ? matrix.topics : [];

    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-4">
        <PageHeader title={t.know.title} subtitle={t.know.subtitle} />

        <div className={cx.j(cx.card, "p-3 flex flex-wrap gap-3 items-end")}>
          <div className="flex-1 min-w-[240px]">
            <label className={cx.label}>{t.common.search}</label>
            <div className="relative">
              <input
                type="text"
                className={cx.input}
                placeholder={t.know.searchPlaceholder}
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
              <Icon name="search" className="absolute right-3 top-2.5 w-4 h-4 text-tx3" />
            </div>
          </div>
          <div className="w-40">
            <label className={cx.label}>{t.ws.target}</label>
            <CustomSelect
              value={filters.target}
              onChange={(val) => setFilters((f) => ({ ...f, target: val }))}
              placeholder={t.common.empty}
              options={[{ value: "", label: t.common.empty }, ...targets.map(v => ({ value: v, label: String(v).toUpperCase() }))]}
            />
          </div>
          <div className="w-40">
            <label className={cx.label}>{t.proj.mcVersion}</label>
            <CustomSelect
              value={filters.mcVersion}
              onChange={(val) => setFilters((f) => ({ ...f, mcVersion: val }))}
              placeholder={t.common.empty}
              options={[{ value: "", label: t.common.empty }, ...mcMajors.map(v => ({ value: v, label: v }))]}
            />
          </div>
          <div className="w-40">
            <label className={cx.label}>{t.know.topic}</label>
            <CustomSelect
              value={filters.topic}
              onChange={(val) => setFilters((f) => ({ ...f, topic: val }))}
              placeholder={t.know.allTopics}
              options={[{ value: "", label: t.know.allTopics }, ...topics.map(v => ({ value: v, label: v }))]}
            />
          </div>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-md p-3 text-xs text-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-tx3">{t.common.loading}…</div>
        ) : results.length === 0 ? (
          <EmptyState icon="info" title={t.know.noResults} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((item, idx) => <KnowledgeCard key={(item && item.id) || idx} item={item} />)}
          </div>
        )}
      </div>
    );
  }

  window.MCFL.Knowledge = Knowledge;
})();
