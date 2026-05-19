window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, Icon } = window.MCFL;

  function PatchReviewModal({ open, patch, t, onApprove, onReject, onRefine, onClose }) {
    const [refineText, setRefineText] = useState("");

    useEffect(() => {
      const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
      if (open) window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }, [open, onClose]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
        <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
        
        <div className={cx.j(cx.card, "relative w-full max-w-4xl max-h-full flex flex-col shadow-2xl ring-1 ring-border")}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Icon name="git" className="w-5 h-5 text-mc" />
              <span className="font-bold">{t.ws.patchTitle}</span>
            </div>
            <button onClick={onClose} className={cx.btnIcon}>
              <Icon name="close" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 bg-bg-log">
            <pre className="text-xs font-mono text-tx1 whitespace-pre-wrap break-all leading-relaxed">
              {patch || t.ws.patchEmpty}
            </pre>
          </div>

          <div className="p-4 border-t border-border space-y-4">
            <div className="space-y-2">
              <label className={cx.label}>{t.ws.patchRefine}</label>
              <textarea 
                className={cx.textarea} 
                rows={2} 
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder="E.g. Change the package name or fix a logic flaw..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={onApprove} 
                className={cx.j(cx.btnPrimary, "px-6")}
              >
                <Icon name="check" className="w-4 h-4" />
                {t.ws.patchApprove}
              </button>
              
              <button 
                onClick={() => onRefine(refineText)} 
                disabled={!refineText.trim()}
                className={cx.btnSecondary}
              >
                <Icon name="spark" className="w-4 h-4" />
                {t.ws.patchRefine}
              </button>

              <div className="ml-auto">
                <button onClick={onReject} className={cx.btnDanger}>
                  <Icon name="close" className="w-4 h-4" />
                  {t.ws.patchReject}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.MCFL.PatchReviewModal = PatchReviewModal;
})();
