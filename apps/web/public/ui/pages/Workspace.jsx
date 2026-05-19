window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useRef } = React;
  const { 
    cx, api, Icon, PageHeader, EmptyState, StatusBadge, ProjectCard, 
    PromptComposer, BuildLogPanel, WorkspaceTimeline, FileTreeView,
    FilePreviewPane, PatchReviewModal
  } = window.MCFL;

  function Workspace({ t, selectedProject, onSelectProject }) {
    const [projects, setProjects] = useState([]);
    const [workflows, setWorkflows] = useState([]);
    const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
    
    // Run State
    const [runId, setRunId] = useState(null);
    const [runStatus, setRunStatus] = useState("idle"); // idle | running | waiting_confirmation | success | failed | canceled
    const [steps, setSteps] = useState([]);
    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [patchPending, setPatchPending] = useState(null);
    const [logs, setLogs] = useState(["[mc-forgelab] workspace ready"]);

    const esRef = useRef(null);
    const stepsRef = useRef({});

    useEffect(() => {
      api.projects().then(setProjects).catch(() => setProjects([]));
      api.workflows().then(wf => {
        setWorkflows(wf);
        if (wf.length > 0) {
          const def = wf.find(w => w.id === "simple-single-model") || wf[0];
          setSelectedWorkflowId(def.id);
        }
      }).catch(() => {});

      return () => { if (esRef.current) esRef.current.close(); };
    }, []);

    const handleEvent = (ev) => {
      const { type, data, stepRowId } = ev;
      
      if (type === "heartbeat") return;
      
      if (type === "run_started") {
        setRunStatus("running");
        setLogs(prev => [...prev, `[run] started: ${ev.runId}`]);
      } else if (type === "run_state") {
        setRunStatus(data.status);
      } else if (type === "step_started") {
        stepsRef.current[stepRowId] = {
          stepRowId,
          role: data.role,
          status: "running",
          logs: [],
          tokensIn: 0,
          tokensOut: 0,
          durationMs: 0
        };
        updateStepsList();
      } else if (type === "step_log") {
        const s = stepsRef.current[stepRowId];
        if (s) {
          s.logs = [...(s.logs || []), data.message];
          updateStepsList();
        }
      } else if (type === "model_delta") {
        const s = stepsRef.current[stepRowId];
        if (s) {
          s.modelChunks = (s.modelChunks || "") + (data.chunk || "");
          updateStepsList();
        }
      } else if (type === "step_finished") {
        const s = stepsRef.current[stepRowId];
        if (s) {
          Object.assign(s, {
            status: data.status,
            durationMs: data.durationMs,
            tokensIn: data.tokensIn,
            tokensOut: data.tokensOut,
            outputSummary: data.outputSummary
          });

          // If it's a code generator, try to extract files
          if (s.role === "coder" && data.outputSummary) {
            try {
              const summary = JSON.parse(data.outputSummary);
              if (Array.isArray(summary.files)) {
                setFiles(summary.files);
              }
            } catch (e) { /* silent ignore */ }
          }
          updateStepsList();
        }
      } else if (type === "patch_pending") {
        setRunStatus("waiting_confirmation");
        setPatchPending({ stepRowId, diffPreview: data.diffPreview });
      } else if (type === "run_finished") {
        setRunStatus(data.status);
        setLogs(prev => [...prev, `[run] finished: ${data.status}`]);
        if (esRef.current) { esRef.current.close(); esRef.current = null; }
      } else if (type === "error") {
        setRunStatus("failed");
        setLogs(prev => [...prev, `[error] stream interrupted`]);
      }
    };

    const updateStepsList = () => {
      setSteps(Object.values(stepsRef.current).sort((a, b) => {
        // Simple heuristic: newer steps are later. In real app we might need a sequence number
        return a.stepRowId.localeCompare(b.stepRowId);
      }));
    };

    const onStart = async (params) => {
      if (!selectedProject) return;
      
      try {
        setRunStatus("starting");
        setSteps([]);
        stepsRef.current = {};
        setFiles([]);
        setActiveFile(null);
        setPatchPending(null);
        
        const body = {
          workflowId: selectedWorkflowId,
          prompt: params.prompt,
          projectId: selectedProject.id,
          settings: { patchReview: params.patchReview }
        };

        const { runId: newRunId } = await api.startWorkflowRun(body);
        setRunId(newRunId);
        
        if (esRef.current) esRef.current.close();
        esRef.current = api.streamWorkflowRun(newRunId, handleEvent);
      } catch (err) {
        setRunStatus("failed");
        setLogs(prev => [...prev, `[error] ${err.message}`]);
      }
    };

    const onCancel = async () => {
      if (!runId || !window.confirm(t.ws.cancelConfirm)) return;
      try {
        await api.cancelWorkflowRun(runId);
      } catch (err) {
        setLogs(prev => [...prev, `[error] cancel failed: ${err.message}`]);
      }
    };

    const handleConfirm = async (decision) => {
      if (!runId) return;
      try {
        await api.confirmWorkflowPatch(runId, decision);
        setPatchPending(null);
        if (decision === "reject") setRunStatus("failed");
        else setRunStatus("running");
      } catch (err) {
        setLogs(prev => [...prev, `[error] confirmation failed: ${err.message}`]);
      }
    };

    const activeFileObj = files.find(f => f.path === activeFile);

    return (
      <div className="p-6 max-w-[1800px] mx-auto">
        <PageHeader
          title={t.ws.title}
          subtitle={t.ws.subtitle}
          badge={
            <div className="flex items-center gap-2">
              <StatusBadge variant={
                runStatus === "success" ? "success" : 
                runStatus === "failed" ? "danger" : 
                runStatus === "idle" ? "neutral" : "info"
              } label={t.ws[`run${runStatus.charAt(0).toUpperCase() + runStatus.slice(1)}`] || runStatus} />
              {runStatus === "running" && (
                <button onClick={onCancel} className={cx.j(cx.btnDanger, "h-7 px-2 text-2xs")}>
                  {t.common.cancel}
                </button>
              )}
            </div>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr_360px] gap-3">
          {/* LEFT: projects + file tree */}
          <aside className="space-y-3 min-w-0">
            <div>
              <div className={cx.sectionTitle}>{t.common.projects}</div>
              <div className="space-y-1.5 max-h-[300px] overflow-auto pr-1">
                {projects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onSelect={onSelectProject}
                    selected={selectedProject && selectedProject.id === p.id}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className={cx.sectionTitle}>{t.ws.fileTree}</div>
              <div className={cx.j(cx.card, "p-1 min-h-[200px]")}>
                <FileTreeView 
                  files={files} 
                  activePath={activeFile} 
                  onSelect={setActiveFile} 
                  t={t} 
                />
              </div>
            </div>
          </aside>

          {/* CENTER: prompt composer + timeline */}
          <section className="space-y-3 min-w-0">
            {!selectedProject ? (
              <EmptyState icon="cpu" title={t.ws.pickProject} description={t.dash.noProjects} />
            ) : (
              <>
                <PromptComposer 
                  t={t} 
                  disabled={runStatus === "running" || runStatus === "waiting_confirmation" || runStatus === "starting"} 
                  onSubmit={onStart} 
                />
                
                {workflows.length > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-elevated/30 rounded border border-border/50">
                    <span className="text-2xs uppercase text-tx3 font-semibold px-1">{t.ws.workflow}</span>
                    {workflows.map(wf => (
                      <button 
                        key={wf.id}
                        onClick={() => setSelectedWorkflowId(wf.id)}
                        disabled={runStatus === "running"}
                        className={selectedWorkflowId === wf.id ? cx.chipActive : cx.chipNeutral}
                      >
                        {wf.name}
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <div className={cx.sectionTitle}>{t.ws.timeline}</div>
                  <WorkspaceTimeline t={t} steps={steps} activeStepId={patchPending?.stepRowId} />
                </div>
              </>
            )}
          </section>

          {/* RIGHT: file preview + build log */}
          <aside className="space-y-3 min-w-0">
            <div className="h-[450px]">
              <div className={cx.sectionTitle}>{t.ws.filePreview}</div>
              <div className={cx.j(cx.card, "h-full overflow-hidden")}>
                <FilePreviewPane file={activeFileObj} t={t} />
              </div>
            </div>
            <div>
              <div className={cx.sectionTitle}>{t.ws.buildLog}</div>
              <BuildLogPanel lines={logs} title="workspace.log" />
            </div>
          </aside>
        </div>

        <PatchReviewModal 
          open={!!patchPending}
          patch={patchPending?.diffPreview}
          t={t}
          onApprove={() => handleConfirm("approve")}
          onReject={() => handleConfirm("reject")}
          onRefine={(txt) => setLogs(prev => [...prev, `[ui] refine captured: ${txt}`])}
          onClose={() => setPatchPending(null)}
        />
      </div>
    );
  }

  window.MCFL.Workspace = Workspace;
})();
