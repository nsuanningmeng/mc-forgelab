window.MCFL = window.MCFL || {};
(function () {
  const { useState } = React;
  const { cx, Icon, StatusBadge } = window.MCFL;

  const TARGETS = ["paper", "fabric", "velocity", "forge"];

  function PromptComposer({ t, disabled, onSubmit }) {
    const [prompt, setPrompt] = useState("");
    const [target, setTarget] = useState("paper");
    const [mode, setMode] = useState("quick");
    const [autoBuild, setAutoBuild] = useState(true);
    const [patchReview, setPatchReview] = useState(false);

    const submit = (e) => {
      e.preventDefault();
      if (disabled) return;
      onSubmit && onSubmit({ prompt, target, mode, autoBuild, patchReview });
    };

    return (
      <form onSubmit={submit} className={cx.j(cx.card, "p-3 space-y-3")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-tx2 font-semibold">
            <Icon name="spark" className="w-3.5 h-3.5" />
            <span>{t.ws.prompt}</span>
          </div>
        </div>

        <textarea
          className={cx.textarea}
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t.ws.promptPlaceholder}
          disabled={disabled}
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-2xs uppercase tracking-wider text-tx2 mr-1">{t.ws.target}</span>
            {TARGETS.map((tg) => (
              <button
                key={tg}
                type="button"
                disabled={disabled}
                onClick={() => setTarget(tg)}
                className={target === tg ? cx.chipActive : cx.chipNeutral}
              >
                {tg}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-2xs uppercase tracking-wider text-tx2 mr-1">{t.ws.mode}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setMode("quick")}
              className={mode === "quick" ? cx.chipActive : cx.chipNeutral}
            >
              {t.ws.modeQuick}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setMode("workflow")}
              className={mode === "workflow" ? cx.chipActive : cx.chipNeutral}
            >
              {t.ws.modeWorkflow}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-tx2">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoBuild}
              onChange={(e) => setAutoBuild(e.target.checked)}
              className="accent-mc"
              disabled={disabled}
            />
            <span>{t.ws.autoBuild}</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={patchReview}
              onChange={(e) => setPatchReview(e.target.checked)}
              className="accent-mc"
              disabled={disabled}
            />
            <span>{t.ws.patchReview}</span>
          </label>
          <div className="ml-auto">
            <button type="submit" disabled={disabled || prompt.trim().length === 0} className={cx.btnPrimary}>
              <Icon name="play" className="w-3.5 h-3.5" />
              {t.ws.generate}
            </button>
          </div>
        </div>
      </form>
    );
  }

  window.MCFL.PromptComposer = PromptComposer;
})();
