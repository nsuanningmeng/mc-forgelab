// EmptyState — honest placeholder with optional "Planned" / "Early dev" badge
window.MCFL = window.MCFL || {};
(function () {
  const { cx, Icon, StatusBadge } = window.MCFL;

  // variant: "default" | "planned" | "early-dev"
  function EmptyState({ icon = "info", title, description, variant = "default", action }) {
    const badge =
      variant === "planned" ? <StatusBadge variant="planned" label="planned" />
      : variant === "early-dev" ? <StatusBadge variant="warn" label="early dev" />
      : null;

    return (
      <div className={cx.j(cx.card, "px-6 py-10 flex flex-col items-center text-center gap-3")}>
        <div className="w-10 h-10 rounded-md bg-elevated border border-border flex items-center justify-center text-tx2">
          <Icon name={icon} className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-tx1">{title}</h3>
          {badge}
        </div>
        {description && (
          <p className="text-xs text-tx2 max-w-md leading-relaxed">{description}</p>
        )}
        {action && <div className="pt-1">{action}</div>}
      </div>
    );
  }

  window.MCFL.EmptyState = EmptyState;
})();
