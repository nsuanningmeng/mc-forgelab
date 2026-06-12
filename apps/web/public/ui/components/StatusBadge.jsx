// StatusBadge — compact status chip with icon + label
window.MCFL = window.MCFL || {};
(function () {
  const { cx } = window.MCFL;

  // variant: success | info | warn | danger | neutral | planned
  function StatusBadge({ variant = "neutral", label, dot = true, "data-testid": testId = "status-badge" }) {
    return (
      <span data-testid={testId} className={cx.j(cx.badges[variant] || cx.badges.neutral, "status-badge", "whitespace-nowrap")}>
        {dot && (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: "currentColor" }}
          />
        )}
        <span>{label}</span>
      </span>
    );
  }
  window.MCFL.StatusBadge = StatusBadge;

  // status-id → variant map (workflow / build conventional)
  window.MCFL.statusVariant = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "running" || s === "in_progress") return "info";
    if (s === "success" || s === "succeeded" || s === "ok") return "success";
    if (s === "failed" || s === "error") return "danger";
    if (s === "skipped") return "warn";
    if (s === "pending" || s === "queued") return "neutral";
    return "neutral";
  };
})();
