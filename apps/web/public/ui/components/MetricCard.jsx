// MetricCard — single numeric metric with label
window.MCFL = window.MCFL || {};
(function () {
  const { cx, Icon } = window.MCFL;

  function MetricCard({ label, value, hint, icon, tone = "default", loading }) {
    const valueColor =
      tone === "success" ? "text-mc"
      : tone === "info" ? "text-blue"
      : tone === "warn" ? "text-warn"
      : tone === "danger" ? "text-danger"
      : "text-tx1";

    return (
      <div className={cx.j(cx.card, "px-4 py-3 flex items-start justify-between gap-3")}>
        <div className="min-w-0">
          <div className="text-2xs font-semibold uppercase tracking-wider text-tx2">{label}</div>
          <div className={cx.j("mt-1 text-2xl font-semibold tabular-nums", valueColor, cx.mono)}>
            {loading ? <span className="text-tx3">—</span> : value}
          </div>
          {hint && <div className="text-2xs text-tx3 mt-1 truncate">{hint}</div>}
        </div>
        {icon && (
          <div className="text-tx3">
            <Icon name={icon} className="w-5 h-5" />
          </div>
        )}
      </div>
    );
  }

  window.MCFL.MetricCard = MetricCard;
})();
