window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useRef } = React;
  const {
    cx, Icon, EmptyState,
    FileTreeView, BuildLogPanel, ArtifactTable,
    Store, api
  } = window.MCFL;

  function InspectorColumn({ t }) {
    const [activeTab, setActiveTab] = useState('files');
    const [state, setState] = useState(Store.getState());
    const [buildLogs, setBuildLogs] = useState([]);
    const [isBuilding, setIsBuilding] = useState(false);
    const eventSourceRef = useRef(null);

    useEffect(() => {
      const unsub = Store.subscribe(s => setState({ ...s }));
      return unsub;
    }, []);

    const { activeProjectId, fileTree, currentBuild, artifacts } = state;

    useEffect(() => {
      if (!activeProjectId) return;

      if (activeTab === 'artifacts') {
        api.artifacts(activeProjectId)
          .then(data => Store.dispatch('SET_ARTIFACTS', data))
          .catch(console.error);
      } else if (activeTab === 'build' && !currentBuild) {
        api.builds(activeProjectId)
          .then(builds => {
            if (builds && builds.length > 0) {
              Store.dispatch('SET_CURRENT_BUILD', builds[0]);
            }
          })
          .catch(console.error);
      }
    }, [activeProjectId, activeTab]);

    useEffect(() => {
      if (currentBuild && (currentBuild.status === 'running' || currentBuild.status === 'pending')) {
        startLogStream(currentBuild.buildId || currentBuild.id);
      }
      return () => stopLogStream();
    }, [currentBuild?.buildId || currentBuild?.id]);

    const startLogStream = (buildId) => {
      stopLogStream();
      setIsBuilding(true);
      const es = api.streamBuild(activeProjectId, buildId, (event) => {
        if (event.type === 'log' || event.type === 'build_log') {
          setBuildLogs(prev => [...prev, event.line || event.message || '']);
        } else if (event.type === 'build_finished' || event.type === 'step_finished') {
          setIsBuilding(false);
          api.artifacts(activeProjectId).then(data => Store.dispatch('SET_ARTIFACTS', data));
          api.build(activeProjectId, buildId).then(b => Store.dispatch('SET_CURRENT_BUILD', b)).catch(() => {});
        }
      });
      eventSourceRef.current = es;
    };

    const stopLogStream = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const handleStartBuild = async () => {
      if (!activeProjectId || isBuilding) return;
      try {
        setBuildLogs(["Starting new build..."]);
        const newBuild = await api.startBuild(activeProjectId);
        Store.dispatch('SET_CURRENT_BUILD', newBuild);
      } catch (err) {
        setBuildLogs(prev => [...prev, `Error: ${err.message}`]);
      }
    };

    const handleFileSelect = (path) => {
      console.log("Selected file:", path);
    };

    const tabs = [
      { id: 'files', label: t.ws?.fileTree || 'Files', icon: 'folder', badge: fileTree?.length },
      { id: 'build', label: t.ws?.buildLog || 'Build', icon: 'terminal' },
      { id: 'artifacts', label: t.nav?.artifacts || 'Artifacts', icon: 'box' },
    ];

    return (
      <aside className="w-[400px] border-l border-border bg-surface flex flex-col shrink-0 overflow-hidden">
        <div className="flex border-b border-border bg-bg/50">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cx.j(
                "flex-1 flex items-center justify-center gap-2 h-11 text-xs font-medium transition-colors border-b-2",
                activeTab === tab.id ? "text-mc border-mc bg-mc/5" : "text-tx3 border-transparent hover:text-tx2"
              )}
            >
              <Icon name={tab.icon} className="w-3.5 h-3.5" />
              {tab.label}
              {tab.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-border text-[10px] text-tx2 font-mono">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!activeProjectId ? (
            <div className="h-full flex items-center justify-center p-8">
              <EmptyState
                icon="box"
                title={t.ws?.pickProject || "No Project Selected"}
                description={t.ws?.subtitle || "Select or create a project to start coding."}
              />
            </div>
          ) : (
            <>
              {activeTab === 'files' && (
                <div className="flex flex-col h-full">
                  <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
                    <h4 className={cx.sectionTitle}>{t.ws?.fileTree || 'Files'}</h4>
                    <button
                      className={cx.btnIcon}
                      onClick={() => api.project(activeProjectId).then(p => Store.dispatch('SET_FILE_TREE', p.files || [])).catch(() => {})}
                    >
                      <Icon name="refresh" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {fileTree && fileTree.length > 0 ? (
                      <FileTreeView files={fileTree} onSelect={handleFileSelect} t={t} />
                    ) : (
                      <div className="py-20">
                        <EmptyState icon="folder" title={t.common?.empty || "No files"} description="Files will appear after project generation." />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'build' && (
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
                    <div className="flex flex-col">
                      <h4 className={cx.sectionTitle}>{t.ws?.buildLog || 'Build Log'}</h4>
                      {currentBuild && (
                        <span className="text-[10px] text-tx3 font-mono">#{(currentBuild.buildId || currentBuild.id || '').slice(0,8)}</span>
                      )}
                    </div>
                    <button
                      className={cx.btnPrimary}
                      disabled={isBuilding}
                      onClick={handleStartBuild}
                    >
                      {isBuilding ? (t.ws?.building || "Building...") : (t.ws?.startBuild || "Start Build")}
                    </button>
                  </div>
                  <div className="flex-1 bg-bg-log overflow-hidden">
                    <BuildLogPanel
                      lines={buildLogs}
                      title={currentBuild ? `build-${(currentBuild.buildId || currentBuild.id || '').slice(0,8)}.log` : "build.log"}
                      emptyText={t.ws?.noBuildLogs || "No logs available. Start a build to see output."}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'artifacts' && (
                <div className="flex flex-col h-full">
                  <div className="p-3 border-b border-border shrink-0">
                    <h4 className={cx.sectionTitle}>{t.nav?.artifacts || 'Artifacts'}</h4>
                  </div>
                  <div className="flex-1 overflow-auto">
                    {artifacts && artifacts.length > 0 ? (
                      <ArtifactTable artifacts={artifacts} projectId={activeProjectId} t={t.common || t} />
                    ) : (
                      <div className="py-20">
                        <EmptyState icon="box" title={t.common?.empty || "Empty"} description={t.ws?.noArtifacts || "No artifacts built yet."} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    );
  }

  window.MCFL.InspectorColumn = InspectorColumn;
})();
