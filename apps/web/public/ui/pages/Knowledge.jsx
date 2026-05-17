window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useCallback } = React;
  const { cx, api, PageHeader, EmptyState, Icon, StatusBadge } = window.MCFL;

  function KnowledgeCard({ item, t }) {
    return (
      <div className={cx.j(cx.card, "p-4 hover:border-mc/40 transition-colors group")}>
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold text-tx1 group-hover:text-mc transition-colors">{item.title}</h3>
          {item.priority > 0 && <StatusBadge variant="warn" label="Hot" />}
        </div>
        <p className="text-xs text-tx2 mb-3 line-clamp-4 leading-relaxed">{item.content}</p>
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded bg-elevated text-tx3 text-2xs border border-border/60 uppercase tracking-tighter">
              {tag}
            </span>
          ))}
        </div>
      </div>
    );
  }

  function Knowledge({ t }) {
    const [matrix, setMatrix] = useState({ targets: [], mcVersions: [], topics: [] });
    const [filters, setFilters] = useState({ target: '', mcVersion: '', topic: '', q: '' });
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      api.knowledgeMatrix().then(setMatrix).catch(() => {});
    }, []);

    const search = useCallback(() => {
      setLoading(true);
      api.knowledgeSearch(filters)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, [filters]);

    useEffect(() => {
      const timer = setTimeout(search, 300);
      return () => clearTimeout(timer);
    }, [search]);

    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-4">
        <PageHeader title={t.know.title} subtitle={t.know.subtitle} />

        <div className={cx.j(cx.card, "p-3 flex flex-wrap gap-3 items-end bg-elevated/20")}>
          <div className="flex-1 min-w-[240px]">
            <label className={cx.label}>{t.common.search}</label>
            <div className="relative">
              <input
                type="text"
                className={cx.input}
                placeholder={t.know.searchPlaceholder}
                value={filters.q}
                onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
              />
              <Icon name="search" className="absolute right-3 top-2.5 w-4 h-4 text-tx3" />
            </div>
          </div>
          <div className="w-40">
            <label className={cx.label}>{t.ws.target}</label>
            <select className={cx.select} value={filters.target} onChange={e => setFilters(f => ({ ...f, target: e.target.value }))}>
              <option value="">{t.common.empty}</option>
              {matrix.targets.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="w-40">
            <label className={cx.label}>{t.proj.mcVersion}</label>
            <select className={cx.select} value={filters.mcVersion} onChange={e => setFilters(f => ({ ...f, mcVersion: e.target.value }))}>
              <option value="">{t.common.empty}</option>
              {matrix.mcVersions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="w-40">
            <label className={cx.label}>{t.know.topic}</label>
            <select className={cx.select} value={filters.topic} onChange={e => setFilters(f => ({ ...f, topic: e.target.value }))}>
              <option value="">{t.know.allTopics}</option>
              {matrix.topics.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-tx3">{t.common.loading}...</div>
        ) : results.length === 0 ? (
          <EmptyState icon="info" title={t.know.noResults} variant="neutral" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map(item => <KnowledgeCard key={item.id} item={item} t={t} />)}
          </div>
        )}
      </div>
    );
  }

  window.MCFL.Knowledge = Knowledge;
})();
