// WorkflowStepCard — single step in a workflow run
window.MCFL = window.MCFL || {};
(function () {
  const { cx, StatusBadge, statusVariant } = window.MCFL;

  function fmtMs(ms) {
    if (!Number.isFinite(Number(ms))) return "—";
    const v = Number(ms);
    if (v < 1000) return `${v} ms`;
    if (v < 60_000) return `${(v / 1000).toFixed(1)} s`;
    return `${(v / 60_000).toFixed(1)} min`;
  }

  function WorkflowStepCard({ step }) {
    const variant = statusVariant(step.status);
    return (
      <div className={cx.j(cx.card, "px-3 py-2.5 flex items-center gap-3")}>
        <div className="shrink-0">
          <StatusBadge variant={variant} label={step.status || "pending"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-tx1 font-medium truncate">
            {step.name || step.step_name || "step"}
          </div>
          <div className="text-2xs text-tx2 mt-0.5 flex items-center gap-2 flex-wrap">
            {step.model_profile && (
              <span className={cx.mono}>{step.model_profile}</span>
            )}
            {(step.tokens_in || step.tokens_out) && (
              <span className={cx.mono}>
                {(step.tokens_in || 0)}↑ / {(step.tokens_out || 0)}↓
              </span>
            )}
          </div>
        </div>
        <div className={cx.j("text-2xs text-tx3 shrink-0", cx.mono)}>
          {fmtMs(step.duration_ms)}
        </div>
      </div>
    );
  }

  window.MCFL.WorkflowStepCard = WorkflowStepCard;
})();
