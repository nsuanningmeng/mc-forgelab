window.MCFL = window.MCFL || {};
(function () {
  const { cx, Icon, EmptyState } = window.MCFL;

  function FilePreviewPane({ file, t }) {
    if (!file) {
      return (
        <EmptyState 
          icon="file" 
          title={t.ws.noFile} 
          description={t.ws.previewSelectHint} 
        />
      );
    }

    const content = file.content || "";
    const lines = content.split("\n");

    const copy = () => {
      navigator.clipboard.writeText(content);
      // Feedback could be added here
    };

    return (
      <div className="flex flex-col h-full min-h-[400px]">
        <div className="flex items-center justify-between gap-4 px-3 py-2 bg-elevated/50 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="file" className="w-4 h-4 text-tx3 flex-shrink-0" />
            <span className="text-xs font-mono text-tx2 truncate">{file.path}</span>
          </div>
          <button 
            onClick={copy}
            className={cx.j(cx.btnGhost, "p-1 h-7 w-7")} 
            title={t.common.copy}
          >
            <Icon name="copy" className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto mcfl-log p-0 text-[11px] leading-relaxed relative">
          <div className="flex min-h-full">
            {/* Gutter */}
            <div className="bg-bg/40 border-r border-border/50 text-tx3 text-right pr-2 pl-3 py-3 select-none sticky left-0 z-10">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            {/* Code content */}
            <pre data-testid="file-preview-content" className="flex-1 p-3 whitespace-pre-wrap break-all text-tx1">
              {content || <span className="text-tx3 italic">/* {t.ws.patchEmpty} */</span>}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  window.MCFL.FilePreviewPane = FilePreviewPane;
})();
