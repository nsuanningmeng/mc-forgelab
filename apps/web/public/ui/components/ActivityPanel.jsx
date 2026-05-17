window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, StatusBadge } = window.MCFL;

  function ActivityPanel({ t }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
      api.audit(10).then(setEvents).catch(() => {}).finally(() => setLoading(false));
    };

    useEffect(() => {
      load();
      const timer = setInterval(load, 30000);
      return () => clearInterval(timer);
    }, []);

    const formatTime = (ts) => {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const getVariant = (type) => {
      if (type.includes('create')) return 'success';
      if (type.includes('delete')) return 'danger';
      if (type.includes('build')) return 'info';
      return 'neutral';
    };

    return (
      <div className={cx.j(cx.card, "overflow-hidden")}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-elevated/30">
          <h3 className="text-xs font-semibold text-tx1 uppercase tracking-wider flex items-center gap-2">
            <Icon name="activity" className="w-3.5 h-3.5 text-mc" />
            {t.dash.recentActivity}
          </h3>
          <button onClick={load} className="text-tx3 hover:text-tx1 transition-colors">
            <Icon name="refresh" className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="divide-y divide-border/40">
          {events.length === 0 ? (
            <div className="p-8 text-center text-xs text-tx3 italic">
              {loading ? t.common.loading : t.common.empty}
            </div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="px-4 py-2.5 hover:bg-elevated/20 transition-colors flex items-center gap-3">
                <StatusBadge variant={getVariant(ev.type)} label={ev.type.split(':')[1] || ev.type} dot={false} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-tx1 truncate">
                    {ev.message || `${ev.type} on ${ev.entityId}`}
                  </div>
                </div>
                <div className="text-2xs text-tx3 whitespace-nowrap tabular-nums">
                  {formatTime(ev.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  window.MCFL.ActivityPanel = ActivityPanel;
})();
