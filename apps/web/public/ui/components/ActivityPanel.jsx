window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api, Icon, StatusBadge } = window.MCFL;

  // /api/audit returns SQLite rows with snake_case columns:
  //   { id, event_type, entity_type, entity_id, payload_json, created_at }
  // Accept both shapes so this panel doesn't crash if the backend ever
  // returns a normalised camelCase variant.
  function normalise(ev) {
    if (!ev || typeof ev !== "object") return null;
    return {
      id: ev.id,
      eventType: String(ev.event_type ?? ev.eventType ?? ""),
      entityType: ev.entity_type ?? ev.entityType ?? "",
      entityId: ev.entity_id ?? ev.entityId ?? "",
      timestamp: ev.created_at ?? ev.createdAt ?? ev.timestamp ?? null,
      payload: ev.payload_json ?? ev.payload ?? null,
    };
  }

  function getVariant(eventType) {
    const t = String(eventType || "");
    if (t.includes("create")) return "success";
    if (t.includes("delete")) return "danger";
    if (t.includes("build")) return "info";
    return "neutral";
  }

  function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function shortLabel(eventType) {
    const t = String(eventType || "");
    const idx = t.indexOf(".");
    return idx >= 0 ? t.slice(idx + 1) : (t || "event");
  }

  function ActivityPanel({ t }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = () => {
      if (!api || typeof api.audit !== "function") {
        setLoading(false);
        return;
      }
      api.audit(10)
        .then((rows) => {
          const arr = Array.isArray(rows) ? rows : [];
          setEvents(arr.map(normalise).filter(Boolean));
        })
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    };

    useEffect(() => {
      load();
      const timer = setInterval(load, 30000);
      return () => clearInterval(timer);
    }, []);

    return (
      <div className={cx.j(cx.card, "overflow-hidden")}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-elevated">
          <h3 className="text-xs font-semibold text-tx1 uppercase tracking-wider flex items-center gap-2">
            <Icon name="info" className="w-3.5 h-3.5 text-mc" />
            {t.dash.recentActivity}
          </h3>
          <button onClick={load} className="text-tx3 hover:text-tx1 transition-colors">
            <Icon name="refresh" className={loading ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
          </button>
        </div>
        <div className="divide-y divide-border">
          {events.length === 0 ? (
            <div className="p-8 text-center text-xs text-tx3 italic">
              {loading ? t.common.loading : t.common.empty}
            </div>
          ) : (
            events.map((ev, idx) => (
              <div key={ev.id || idx} className="px-4 py-2.5 hover:bg-elevated transition-colors flex items-center gap-3">
                <StatusBadge variant={getVariant(ev.eventType)} label={shortLabel(ev.eventType)} dot={false} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-tx1 truncate">
                    {ev.eventType} {ev.entityId ? `· ${ev.entityId}` : ""}
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
