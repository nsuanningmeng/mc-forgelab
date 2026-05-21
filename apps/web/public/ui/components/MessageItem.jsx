window.MCFL = window.MCFL || {};
(function () {
  const { MarkdownRenderer, cx, Icon } = window.MCFL;

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
              "px-4 py-3 rounded-2xl text-sm shadow-sm",
              isUser ? "bg-blue text-white rounded-tr-none" : "bg-elevated text-tx1 border border-border/50 rounded-tl-none"
            )}>
              {message.type === 'patch' ? (
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
