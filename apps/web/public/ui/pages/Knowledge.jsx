window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useCallback } = React;
  const { cx, api, PageHeader, EmptyState, Icon, StatusBadge, CustomSelect } = window.MCFL;

  function KnowledgeSkeleton() {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={cx.j(cx.card, "p-4 animate-pulse space-y-3")}>
            <div className="h-4 bg-border rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-border rounded"></div>
              <div className="h-3 bg-border rounded w-5/6"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-4 bg-border rounded w-12"></div>
              <div className="h-4 bg-border rounded w-16"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function FilterSummaryBar({ count, filters, onRemove, onClear, t }) {
    const activeFilters = Object.entries(filters).filter(([key, val]) => val && key !== "q");
    if (count === 0 && activeFilters.length === 0 && !filters.q) return null;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2 px-1">
        <div className="text-xs text-tx3">
          {t.know.foundResults.replace("{n}", count)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map(([key, val]) => (
            <button
              key={key}
              onClick={() => onRemove(key)}
              className="flex items-center gap-1 px-2 py-0.5 bg-mc/10 text-mc border border-mc/20 rounded-full text-2xs hover:bg-mc/20 transition-colors"
            >
              <span className="opacity-70 capitalize">{key}:</span>
              <span className="font-medium">{String(val).toUpperCase()}</span>
              <Icon name="close" className="w-2.5 h-2.5 ml-0.5" />
            </button>
          ))}
          {activeFilters.length > 0 && (
            <button onClick={onClear} className="text-2xs text-tx3 hover:text-mc transition-colors ml-1">
              {t.common.clearAll}
            </button>
          )}
        </div>
      </div>
    );
  }

  function KnowledgeCard({ item, t }) {
    const [expanded, setExpanded] = React.useState(false);
    const tags = Array.isArray(item && item.tags) ? item.tags : [];
    const title = (item && item.title) || (item && item.id) || "";
    const content = (item && item.content) || "";
    const priority = (item && typeof item.priority === "number") ? item.priority : 0;

    const isLong = content.length > 120;
    const displayContent = (!expanded && isLong) ? content.slice(0, 120) + "..." : content;

    return (
      <div className={cx.j(cx.card, "p-4 hover:border-mc/40 transition-all group flex flex-col")}>
        <div className="flex items-start justify-between mb-2 gap-2">
          <h3 className="text-sm font-semibold text-tx1 group-hover:text-mc transition-colors min-w-0 break-words">{title}</h3>
          {priority > 0 && priority <= 2 && <StatusBadge variant="warn" label="Hot" />}
        </div>
        <div className="relative flex-1">
          <p className="text-xs text-tx2 mb-3 leading-relaxed whitespace-pre-wrap break-words">
            {displayContent}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-2xs text-mc hover:underline mb-3"
            >
              {expanded ? t.common.showLess : t.common.showMore}
              <Icon name="chevron-down" className={cx.j("w-3 h-3 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto">
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
    const [hasSearched, setHasSearched] = useState(false);

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
      const isAllEmpty = !filters.q && !filters.target && !filters.mcVersion && !filters.topic;
      if (isAllEmpty) {
        setResults([]);
        setHasSearched(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setHasSearched(true);

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

    const handleRemoveFilter = (key) => {
      setFilters(f => ({ ...f, [key]: "" }));
    };

    const handleClearAll = () => {
      setFilters({ target: "", mcVersion: "", topic: "", q: "" });
    };

    const targets = Array.isArray(matrix.targets) ? matrix.targets : [];
    const mcMajors = Array.isArray(matrix.mcMajors) ? matrix.mcMajors : [];
    const topics = Array.isArray(matrix.topics) ? matrix.topics : [];

    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-4">
        <PageHeader title={t.know.title} subtitle={t.know.subtitle} />

        <div className={cx.j(cx.card, "p-3 flex flex-wrap gap-3 items-end shadow-sm")}>
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

        <FilterSummaryBar
          count={results.length}
          filters={filters}
          onRemove={handleRemoveFilter}
          onClear={handleClearAll}
          t={t}
        />

        {loading ? (
          <KnowledgeSkeleton />
        ) : !hasSearched ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-mc/10 rounded-full flex items-center justify-center mb-4">
              <Icon name="search" className="w-8 h-8 text-mc" />
            </div>
            <h3 className="text-lg font-medium text-tx1 mb-2">{t.know.welcomeTitle}</h3>
            <p className="text-sm text-tx3 max-w-md mb-6">{t.know.welcomeSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {["paper", "spigot", "forge", "fabric"].map(type => (
                <button
                  key={type}
                  onClick={() => setFilters(f => ({ ...f, target: type }))}
                  className="px-4 py-2 bg-elevated border border-border rounded-md text-xs text-tx2 hover:border-mc hover:text-mc transition-all flex items-center gap-2"
                >
                  <Icon name="zap" className="w-3.5 h-3.5" />
                  {t.know.browseLabel.replace("{type}", type.charAt(0).toUpperCase() + type.slice(1))}
                </button>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <EmptyState icon="info" title={t.know.noResults} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((item, idx) => <KnowledgeCard key={(item && item.id) || idx} item={item} t={t} />)}
          </div>
        )}
      </div>
    );
  }

  window.MCFL.Knowledge = Knowledge;
})();
