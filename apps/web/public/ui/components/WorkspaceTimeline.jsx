window.MCFL = window.MCFL || {};
(function () {
  const { cx, Icon, StatusBadge } = window.MCFL;

  const ROLE_MAP = {
    planner: "Planner",
    coder: "Coder",
    reviewer: "Reviewer",
    builder: "Builder",
    executor: "Executor",
  };

  function WorkspaceTimeline({ t, steps, activeStepId }) {
    if (!Array.isArray(steps) || steps.length === 0) {
      return (
        <div className={cx.j(cx.card, "p-8 text-center text-tx3")}>
          <Icon name="git" className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">{t.ws.timelineEmpty}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3 relative">
        <div className="absolute left-5 top-4 bottom-4 w-px bg-border z-0" />
        {steps.map((step) => {
          const isActive = step.stepRowId === activeStepId;
          const isDone = step.status === "success" || step.status === "failed";
          const showDetails = isActive || isDone || step.status === "running";

          let badgeVariant = "neutral";
          if (step.status === "running") badgeVariant = "info";
          else if (step.status === "success") badgeVariant = "success";
          else if (step.status === "failed") badgeVariant = "danger";
          else if (step.status === "skipped") badgeVariant = "warn";

          return (
            <div key={step.stepRowId} className="relative z-10 pl-10">
              <div className="absolute left-3 top-2 w-4 h-4 rounded-full bg-bg border-2 border-border flex items-center justify-center">
                <div className={cx.j("w-1.5 h-1.5 rounded-full", 
                  step.status === "running" ? "bg-blue animate-pulse" : 
                  step.status === "success" ? "bg-mc" : 
                  step.status === "failed" ? "bg-danger" : "bg-tx3"
                )} />
              </div>

              <div className={cx.j(cx.card, "p-3", isActive && "ring-1 ring-mc/30")}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {ROLE_MAP[step.role] || step.role}
                    </span>
                    <StatusBadge 
                      variant={badgeVariant} 
                      label={step.status} 
                      className={step.status === "running" ? "animate-pulse" : ""} 
                    />
                  </div>
                  <div className="flex items-center gap-3 text-2xs text-tx3 font-mono">
                    {step.durationMs > 0 && (
                      <span>{(step.durationMs / 1000).toFixed(1)}s</span>
                    )}
                    {(step.tokensIn > 0 || step.tokensOut > 0) && (
                      <span>{step.tokensIn} / {step.tokensOut} tokens</span>
                    )}
                  </div>
                </div>

                {showDetails && (
                  <div className="mt-2 space-y-2">
                    {step.outputSummary && (
                      <p className="text-xs text-tx2 leading-relaxed">
                        {step.outputSummary}
                      </p>
                    )}
                    
                    {step.modelChunks && (
                      <div className="text-2xs font-mono text-tx3 italic">
                        <Icon name="spark" className="inline w-3 h-3 mr-1" />
                        {t.ws.modelDelta}
                      </div>
                    )}

                    {Array.isArray(step.logs) && step.logs.length > 0 && (
                      <div className="bg-bg/50 rounded p-2 text-[10px] font-mono text-tx2 border border-border/50">
                        {step.logs.slice(-5).map((log, i) => (
                          <div key={i} className="truncate opacity-80">
                            {typeof log === "string" ? log : JSON.stringify(log)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  window.MCFL.WorkspaceTimeline = WorkspaceTimeline;
})();
