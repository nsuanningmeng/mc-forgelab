window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useRef } = React;
  const { Store, MessageItem, cx, Icon, api } = window.MCFL;

  function ChatColumn({ t }) {
    const [state, setState] = useState(Store.getState());
    const [input, setInput] = useState('');
    const [showNewProject, setShowNewProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const scrollRef = useRef(null);
    const isNearBottomRef = useRef(true);

    useEffect(() => {
      const unsub = Store.subscribe(setState);
      Promise.all([
        api.workflows().then(ws => Store.dispatch('SET_WORKFLOWS', ws)),
        api.projects().then(ps => Store.dispatch('SET_PROJECTS', ps))
      ]).catch(err => console.error("Failed to load workspace data", err));

      return () => {
        unsub();
        Store.cancelStream();
      };
    }, []);

    useEffect(() => {
      if (scrollRef.current && isNearBottomRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [state.messages, state.streamingMessage]);

    const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
    };

    const handleSend = async () => {
      if (!input.trim() || state.workflowStatus === 'running') return;
      if (!state.activeProjectId) {
        alert(t.ws?.pickProject || "Please select a project first");
        return;
      }

      const userPrompt = input.trim();
      setInput('');

      Store.dispatch('ADD_MESSAGE', { role: 'user', type: 'text', content: userPrompt });

      try {
        const run = await api.startWorkflowRun({
          projectId: state.activeProjectId,
          workflowId: state.activeWorkflowId,
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

    const onProjectChange = (e) => {
      const proj = state.projects.find(p => p.id === e.target.value);
      Store.dispatch('SET_PROJECT', proj);
    };

    const onWorkflowChange = (e) => {
      Store.dispatch('SET_ACTIVE_WORKFLOW', e.target.value);
    };

    const handleCreateProject = async () => {
      if (!newProjectName.trim()) return;
      try {
        const project = await api.createProject({
          name: newProjectName.trim(),
          targetId: 'paper',
          minecraftVersion: '1.21.4',
          packageName: 'com.example.' + newProjectName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
        });
        Store.dispatch('SET_PROJECT', project);
        Store.dispatch('SET_PROJECTS', [...state.projects, project]);
        setShowNewProject(false);
        setNewProjectName('');
      } catch (err) {
        alert('Failed to create project: ' + err.message);
      }
    };

    return (
      <div className="flex-1 flex flex-col min-w-0 bg-bg">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-surface/50 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center gap-2 bg-elevated/50 px-2 py-1 rounded border border-border/50">
              <Icon name="folder" className="w-4 h-4 text-tx3" />
              <select
                value={state.activeProjectId || ''}
                onChange={onProjectChange}
                className="bg-transparent text-sm font-semibold text-tx1 outline-none cursor-pointer max-w-[150px] truncate"
              >
                {!state.activeProjectId && <option value="">{t.topbar?.noProject || "Select Project..."}</option>}
                {state.projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowNewProject(!showNewProject)}
                className="w-6 h-6 rounded flex items-center justify-center text-tx3 hover:text-mc hover:bg-elevated transition-colors"
                title={t.proj?.newProject || "New Project"}
              >
                <Icon name="plus" className="w-3.5 h-3.5" />
              </button>
            </div>
            {showNewProject && (
              <div className="flex items-center gap-2 bg-elevated/50 px-2 py-1 rounded border border-border/50">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateProject(); }}
                  placeholder={t.proj?.name || "Project name"}
                  className="bg-transparent text-sm text-tx1 outline-none w-32"
                  autoFocus
                />
                <button onClick={handleCreateProject} className="text-xs text-mc hover:underline">{t.common?.create || "Create"}</button>
                <button onClick={() => { setShowNewProject(false); setNewProjectName(''); }} className="text-xs text-tx3 hover:text-tx1">{t.common?.cancel || "Cancel"}</button>
              </div>
            )}
            {state.activeProject && (
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-tx3 mcfl-mono bg-bg/50 px-2 py-1 rounded border border-border/30">
                <span>{state.activeProject.target_id}</span>
                <span className="opacity-30">|</span>
                <span>{state.activeProject.minecraft_version}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-tx3 uppercase tracking-tighter hidden lg:block">{t.ws?.workflow || "Workflow"}:</span>
              <select
                value={state.activeWorkflowId}
                onChange={onWorkflowChange}
                className="bg-elevated border border-border rounded px-2 py-1 text-xs text-tx2 outline-none focus:border-mc/50 cursor-pointer"
              >
                {state.workflows.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-elevated/30 rounded-full border border-border/50">
              <div className={cx.j(
                "w-2 h-2 rounded-full",
                state.workflowStatus === 'running' ? "bg-mc animate-pulse" :
                state.workflowStatus === 'success' ? "bg-green-500" :
                state.workflowStatus === 'failed' ? "bg-red-500" : "bg-tx3"
              )} />
              <span className="text-[10px] text-tx2 font-medium capitalize">
                {state.workflowStatus === 'running' && state.streamingMessage?.step ? state.streamingMessage.step : state.workflowStatus}
              </span>
            </div>
          </div>
        </header>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-3xl mx-auto">
            {state.messages.length === 0 && !state.streamingMessage && (
              <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-elevated rounded-2xl flex items-center justify-center mb-4 text-tx3">
                  <Icon name="spark" className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-medium text-tx1 mb-2">{t.ws?.title || "AI Workspace"}</h3>
                <p className="text-sm text-tx3 max-w-sm">{t.ws?.subtitle || "Describe what you want to build"}</p>
                {!state.activeProjectId && (
                  <p className="mt-4 text-mc text-xs animate-bounce">{t.ws?.pickProject || "Select a project to start"}</p>
                )}
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
                <span className="animate-pulse font-medium">{t.ws?.runRunning || "Processing..."}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  window.MCFL.ChatColumn = ChatColumn;
})();
