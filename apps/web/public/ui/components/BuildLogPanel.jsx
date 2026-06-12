// BuildLogPanel — terminal-style log viewer with copy/download
window.MCFL = window.MCFL || {};
(function () {
  const { useRef, useEffect, useState } = React;
  const { cx, Icon } = window.MCFL;

  function classify(line) {
    const s = line.toLowerCase();
    if (/\b(error|fail|exception|fatal)\b/.test(s)) return "err";
    if (/\b(warn|deprecated)\b/.test(s)) return "warn";
    if (/\b(success|build successful|ok|done)\b/.test(s)) return "ok";
    return "";
  }

  function BuildLogPanel({ lines = [], autoScroll = true, title, emptyText, t }) {
    const ref = useRef(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
      if (autoScroll && ref.current) {
        ref.current.scrollTop = ref.current.scrollHeight;
      }
    }, [lines, autoScroll]);

    const copyAll = async () => {
      try {
        await navigator.clipboard.writeText(lines.join("\n"));
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch {/* ignore */}
    };

    const downloadAll = () => {
      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "build.log";
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className={cx.j(cx.card, "flex flex-col overflow-hidden")}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-elevated">
          <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-tx2 font-semibold">
            <Icon name="terminal" className="w-3.5 h-3.5" />
            <span>{title || "build.log"}</span>
            <span className={cx.j("text-tx3", cx.mono)}>· {lines.length} {t?.common?.linesUnit || "lines"}</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={copyAll} className={cx.btnIcon} title={t?.common?.copy || "Copy"}>
              <Icon name="copy" className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={downloadAll} className={cx.btnIcon} title={t?.common?.download || "Download"}>
              <Icon name="download" className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div ref={ref} className="mcfl-log flex-1 overflow-auto" style={{ minHeight: 120 }}>
          {lines.length === 0 ? (
            <div className="px-3 py-6 text-2xs text-tx3 text-center">
              {emptyText || "No log output yet."}
            </div>
          ) : (
            lines.map((l, i) => (
              <div key={i} className={cx.j("mcfl-log-line px-3", classify(l))}>
                <span className="text-tx3 mr-3 select-none">{String(i + 1).padStart(4, " ")}</span>
                {l}
              </div>
            ))
          )}
        </div>
        {copied && (
          <div className="px-3 py-1 text-2xs text-mc bg-mc/5 border-t border-border">{t?.common?.copied || "Copied"}</div>
        )}
      </div>
    );
  }

  window.MCFL.BuildLogPanel = BuildLogPanel;
})();
