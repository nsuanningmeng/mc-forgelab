window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useRef, useMemo } = React;
  const { Store, MessageItem, cx, Icon, api, CustomSelect } = window.MCFL;

  function ChatColumn({ t }) {
    const [state, setState] = useState(Store.getState());
    const [input, setInput] = useState('');
    const scrollRef = useRef(null);
    const isNearBottomRef = useRef(true);
    const userScrolledUpRef = useRef(false);
    const isCreatingRef = useRef(false);

    useEffect(() => {
      const unsub = Store.subscribe(setState);
      Promise.all([
        api.workflows().then(ws => Store.dispatch('SET_WORKFLOWS', ws)),
        api.projects().then(ps => Store.dispatch('SET_PROJECTS', ps)),
        api.modelProfiles().catch(() => [])
      ]).then(([workflows, _projects, profiles]) => {
        const enabledRoles = new Set(
          (profiles || []).filter(p => p.enabled !== false).map(p => p.role)
        );
        if (enabledRoles.size >= 2) {
          const store = Store.getState();
          if (store.activeWorkflowId === 'simple-single-model') {
            const multiWf = (workflows || []).find(w => w.id === 'paper-plugin-standard');
            if (multiWf) Store.dispatch('SET_ACTIVE_WORKFLOW', multiWf.id);
          }
        }
      }).catch(err => console.error("Failed to load workspace data", err));

      return () => {
        unsub();
        Store.cancelStream();
      };
    }, []);

    useEffect(() => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight <= 60;
      // Auto-scroll if user hasn't explicitly scrolled up, OR they're already near bottom
      if (!userScrolledUpRef.current || isAtBottom) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [state.messages, state.streamingMessage]);

    const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const distFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distFromBottom <= 4) {
        userScrolledUpRef.current = false;
        isNearBottomRef.current = true;
      } else if (distFromBottom > 60) {
        userScrolledUpRef.current = true;
        isNearBottomRef.current = false;
      }
    };

    const deriveProjectName = (prompt) => {
      const sanitized = prompt
        .replace(/[^\w\s一-鿿_-]/g, ' ')
        .replace(/_+/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
      return sanitized.slice(0, 50) || 'Untitled Project';
    };

    const handleSend = async () => {
      if (!input.trim() || state.workflowStatus === 'running' || isCreatingRef.current) return;

      const userPrompt = input.trim();
      setInput('');

      let projectId = state.activeProjectId;

      if (!projectId) {
        let project = state.projects.length > 0 ? state.projects[0] : null;
        if (!project) {
          const autoName = deriveProjectName(userPrompt);
          const alphaPart = autoName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);
          const packageName = 'com.example.' + (alphaPart || 'untitled');
          isCreatingRef.current = true;
          try {
            project = await api.createProject({
              name: autoName,
              targetId: 'paper',
              minecraftVersion: '1.21.4',
              packageName
            });
            const projects = await api.projects();
            Store.dispatch('SET_PROJECTS', projects);
          } catch (err) {
            Store.dispatch('ADD_MESSAGE', { role: 'system', type: 'error', content: 'Failed to create project: ' + err.message });
            return;
          } finally {
            isCreatingRef.current = false;
          }
        }
        Store.dispatch('SET_PROJECT', project);
        projectId = project.id;
      }

      const history = Store.getState().messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.type === 'text')
        .slice(-19)
        .map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }))
        .filter(m => m.content.length > 0);

      Store.dispatch('ADD_MESSAGE', { role: 'user', type: 'text', content: userPrompt });

      try {

        const run = await api.startWorkflowRun({
          projectId,
          workflowId: state.activeWorkflowId,
          prompt: userPrompt,
          history
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

    const onWorkflowChange = (val) => {
      Store.dispatch('SET_ACTIVE_WORKFLOW', val);
    };

    const handleClearChat = () => {
      if (window.confirm(t.ws?.confirmClear || "Are you sure you want to clear the conversation history?")) {
        Store.dispatch('CLEAR_MESSAGES');
      }
    };

    const handleExportChat = () => {
      const projectName = (state.activeProject?.name || "unknown").replace(/[^a-zA-Z0-9_-]/g, '_');
      const date = new Date().toLocaleString();
      const filenameDate = new Date().toISOString().split('T')[0];

      const parts = [`# Chat Export — ${state.activeProject?.name || "unknown"}\nDate: ${date}\n\n`];
      state.messages.forEach(msg => {
        parts.push(`## ${msg.role}\n${msg.content || ""}\n\n`);
      });

      const blob = new Blob([parts.join("")], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${projectName}-${filenameDate}.md`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const workflowOptions = useMemo(() =>
      state.workflows.map(w => ({ value: w.id, label: w.name })),
      [state.workflows]
    );

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-bg">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-surface/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3 overflow-hidden">
            {state.activeProject && (
              <div className="flex items-center gap-2 text-[10px] text-tx3 mcfl-mono bg-bg/50 px-2 py-1 rounded border border-border/30">
                <Icon name="folder" className="w-3 h-3 text-tx3" />
                <span className="text-tx2 font-medium">{state.activeProject.name}</span>
                <span className="opacity-30">|</span>
                <span>{state.activeProject.target_id.charAt(0).toUpperCase() + state.activeProject.target_id.slice(1).toLowerCase()}</span>
                <span className="opacity-30">|</span>
                <span>{state.activeProject.minecraft_version}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {state.messages.length > 0 && (
              <>
                <button
                  onClick={handleExportChat}
                  data-testid="export-chat-btn"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-tx3 hover:text-mc hover:bg-mc/10 rounded transition-colors whitespace-nowrap"
                  title={t.ws?.exportChat || "Export Chat"}
                >
                  <Icon name="download" className="w-3 h-3" />
                  <span className="hidden md:inline">{t.ws?.exportChat || "Export"}</span>
                </button>
                <button
                  onClick={handleClearChat}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-tx3 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors whitespace-nowrap"
                  title={t.ws?.clearChat || "Clear Conversation"}
                >
                  <Icon name="trash" className="w-3 h-3" />
                  <span className="hidden md:inline">{t.ws?.clearChat || "Clear Chat"}</span>
                </button>
              </>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-tx3 uppercase tracking-tighter hidden lg:block font-semibold">{t.ws?.workflow || "Workflow"}:</span>
              <CustomSelect
                value={state.activeWorkflowId}
                onChange={onWorkflowChange}
                options={workflowOptions}
                className="!h-8 !w-48"
              />
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 bg-elevated/30 rounded-full border border-border/50">
              <div className={cx.j(
                "w-2 h-2 rounded-full",
                state.workflowStatus === 'running' ? "bg-mc animate-pulse" :
                state.workflowStatus === 'success' ? "bg-green-500" :
                state.workflowStatus === 'failed' ? "bg-red-500" : "bg-tx3"
              )} />
              <span className="text-[10px] text-tx2 font-bold tracking-tight uppercase">
                {state.workflowStatus === 'running' && state.streamingMessage?.step ? state.streamingMessage.step : state.workflowStatus}
              </span>
            </div>
          </div>
        </header>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-3xl mx-auto">
            {state.loadingMessages && state.messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                <div className="w-8 h-8 border-2 border-mc/30 border-t-mc rounded-full animate-spin mb-4" />
                <p className="text-sm text-tx3">{t.ws?.loadingMessages || "Loading conversation..."}</p>
              </div>
            )}
            {!state.loadingMessages && state.messages.length === 0 && !state.streamingMessage && (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-elevated rounded-2xl flex items-center justify-center mb-4 text-tx3 shadow-xl border border-border/50">
                  <Icon name="spark" className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-tx1 mb-2">{t.ws?.title || "AI Workspace"}</h3>
                <p className="text-sm text-tx3 max-w-sm">{t.ws?.subtitle || "Describe what you want to build"}</p>
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
              placeholder={t.ws?.promptPlaceholder || "Describe what you want to build..."}
              className={cx.j(cx.textarea, "pr-12 min-h-[80px] max-h-[300px] py-3 shadow-lg")}
              disabled={state.workflowStatus === 'running'}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || state.workflowStatus === 'running'}
              className="absolute right-3 bottom-3 w-8 h-8 bg-mc text-white rounded-md flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 shadow-mc/20 shadow-lg"
            >
              <Icon name="spark" className="w-4 h-4" />
            </button>
          </div>
          <div className="max-w-3xl mx-auto mt-2 flex items-center justify-between text-[10px] text-tx3 px-1">
            <div className="flex gap-4">
              <span className="flex items-center gap-1"><kbd className="bg-elevated px-1 rounded border border-border/50">Enter</kbd> to send</span>
              <span className="flex items-center gap-1"><kbd className="bg-elevated px-1 rounded border border-border/50">Shift+Enter</kbd> for newline</span>
            </div>
            {state.workflowStatus === 'running' && (
              <div className="flex items-center gap-2 text-mc">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mc opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-mc"></span>
                </span>
                <span className="animate-pulse font-bold uppercase tracking-wider">{t.ws?.runRunning || "Processing..."}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  window.MCFL.ChatColumn = ChatColumn;
})();
