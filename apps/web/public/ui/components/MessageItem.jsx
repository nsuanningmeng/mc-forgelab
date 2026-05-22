window.MCFL = window.MCFL || {};
(function () {
  const { MarkdownRenderer, cx, Icon } = window.MCFL;

  function FileCards({ files }) {
    const { useState } = React;
    const [expanded, setExpanded] = useState({});

    if (!Array.isArray(files) || files.length === 0) return null;

    const toggle = (idx) => setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-tx2 text-xs mb-2">
          <Icon name="file" className="w-3 h-3" />
          <span>{files.length} file{files.length > 1 ? 's' : ''} generated</span>
        </div>
        {files.map((f, idx) => (
          <div key={idx} className="border border-border/50 rounded-lg overflow-hidden bg-bg/50">
            <button
              onClick={() => toggle(idx)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-elevated/50 transition-colors text-left"
              aria-expanded={!!expanded[idx]}
            >
              <Icon name="chevronR" className={cx.j("w-3 h-3 text-tx3 transition-transform", expanded[idx] && "rotate-90")} />
              <span className={cx.j(
                "font-mono text-[11px] truncate flex-1",
                f.op === 'delete' ? 'text-red-400 line-through' : 'text-tx1'
              )}>
                {f.path}
              </span>
              <span className={cx.j(
                "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight shrink-0",
                f.op === 'create' ? 'bg-green-500/10 text-green-500' :
                f.op === 'update' ? 'bg-blue-500/10 text-blue-500' :
                f.op === 'delete' ? 'bg-red-500/10 text-red-500' :
                'bg-elevated text-tx3'
              )}>
                {f.op}
              </span>
            </button>
            {expanded[idx] && f.content && (
              <div className="border-t border-border/30">
                <pre className="p-3 text-[11px] mcfl-mono bg-bg-log overflow-x-auto max-h-64 overflow-y-auto">
                  <code className="text-tx1">{f.content}</code>
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function MessageItem({ message, isStreaming }) {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';

    return (
      <div className={cx.j("flex w-full mb-6", isUser ? "justify-end" : "justify-start")}>
        <div className={cx.j("max-w-[85%] flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
          <div className={cx.j(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            isUser ? "bg-blue/20 text-blue" : isAssistant ? "bg-mc/20 text-mc" : "bg-elevated text-tx3"
          )}>
            <Icon name={isUser ? "user" : isAssistant ? "spark" : "info"} className="w-4 h-4" />
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <div className={cx.j(
              "px-4 py-3 rounded-2xl text-sm font-medium",
              isUser ? "bg-gray-100 dark:bg-neutral-800 text-tx1 rounded-tr-sm" : "bg-transparent text-tx1 px-0 py-0"
            )}>
              {message.type === 'files' ? (
                <FileCards files={message.content} />
              ) : message.type === 'patch' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-tx2 text-xs mb-2">
                    <Icon name="file" className="w-3 h-3" />
                    <span>Patch suggested</span>
                  </div>
                  <MarkdownRenderer content={message.content} />
                  <div className="flex gap-2 mt-3">
                    <button className={cx.btnPrimary}>Approve</button>
                    <button className={cx.btnSecondary}>Review</button>
                  </div>
                </div>
              ) : message.type === 'error' ? (
                <div className="text-danger flex items-start gap-2">
                  <Icon name="info" className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{message.content}</span>
                </div>
              ) : (
                <MarkdownRenderer content={message.content} isStreaming={isStreaming} />
              )}
            </div>

            <div className={cx.j("text-[10px] text-tx3 px-1", isUser ? "text-right" : "text-left")}>
              {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              {isStreaming && <span className="ml-2 animate-pulse">●</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.MCFL.MessageItem = MessageItem;
})();
