window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useRef } = React;
  const { Store, MessageItem, cx, Icon, api } = window.MCFL;

  function ChatColumn({ t }) {
    const [state, setState] = useState(Store.getState());
    const [input, setInput] = useState('');
    const scrollRef = useRef(null);

    useEffect(() => {
      const unsub = Store.subscribe(setState);
      api.workflows().then(ws => Store.dispatch('SET_WORKFLOWS', ws));
      return unsub;
    }, []);

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [state.messages, state.streamingMessage]);

    const handleSend = async () => {
      if (!input.trim() || state.workflowStatus === 'running') return;

      const userPrompt = input.trim();
      setInput('');

      Store.dispatch('ADD_MESSAGE', { role: 'user', type: 'text', content: userPrompt });

      try {
        const selectedWorkflow = state.workflows[0]?.id || 'simple-single-model';
        const run = await api.startWorkflowRun({
          projectId: state.activeProjectId,
          workflowId: selectedWorkflow,
          prompt: userPrompt
        });
        Store.initWorkflowStream(run.runId);
      } catch (err) {
        Store.dispatch('ADD_MESSAGE', { role: 'system', type: 'error', content: err.message });
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-bg">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-surface/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-tx1">{state.activeProject?.name || t.ws.title}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-tx3 uppercase tracking-wider mcfl-mono">
                  {state.activeProject?.target_id} {state.activeProject && '·'} {state.activeProject?.minecraft_version}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select className="bg-elevated border border-border rounded px-2 py-1 text-xs text-tx2 outline-none focus:border-mc/50">
              {state.workflows.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <div className={cx.j(
              "w-2 h-2 rounded-full",
              state.workflowStatus === 'running' ? "bg-mc animate-pulse" : "bg-tx3"
            )} />
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-3xl mx-auto">
            {state.messages.length === 0 && !state.streamingMessage && (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-elevated rounded-2xl flex items-center justify-center mb-4 text-tx3">
                  <Icon name="spark" className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-tx1 mb-2">{t.ws.title}</h3>
                <p className="text-sm text-tx3 max-w-sm">{t.ws.subtitle}</p>
              </div>
            )}
            {state.messages.map(msg => (
              <MessageItem key={msg.id} message={msg} />
            ))}
            {state.streamingMessage && (
              <MessageItem message={state.streamingMessage} isStreaming={true} />
            )}
          </div>
        </div>

        <div className="p-4 bg-bg shrink-0 border-t border-border">
          <div className="max-w-3xl mx-auto relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.ws.promptPlaceholder || "Describe what you want to build..."}
              className={cx.j(cx.textarea, "pr-12 min-h-[80px] max-h-[300px] py-3 shadow-lg")}
              disabled={state.workflowStatus === 'running'}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || state.workflowStatus === 'running'}
              className="absolute right-3 bottom-3 w-8 h-8 bg-mc text-surface rounded-md flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
            >
              <Icon name="spark" className="w-4 h-4" />
            </button>
          </div>
          <div className="max-w-3xl mx-auto mt-2 flex items-center justify-between text-[10px] text-tx3 px-1">
            <div className="flex gap-4">
              <span className="flex items-center gap-1"><kbd className="bg-elevated px-1 rounded">Enter</kbd> to send</span>
              <span className="flex items-center gap-1"><kbd className="bg-elevated px-1 rounded">Shift+Enter</kbd> for newline</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.MCFL.ChatColumn = ChatColumn;
})();
