window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useRef } = React;
  const {
    cx, Icon, EmptyState,
    FileTreeView, BuildLogPanel, ArtifactTable,
    FilePreviewPane,
    Store, api
  } = window.MCFL;

  function InspectorColumn({ t }) {
    const [activeTab, setActiveTab] = useState('files');
    const [state, setState] = useState(Store.getState());
    const [buildLogs, setBuildLogs] = useState([]);
    const [isBuilding, setIsBuilding] = useState(false);
    const eventSourceRef = useRef(null);
    const [width, setWidth] = useState(400);
    const isResizing = useRef(false);
    const [selectedFile, setSelectedFile] = useState(null);

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
        setBuildLogs([t.ws?.starting || "Starting new build..."]);
        const newBuild = await api.startBuild(activeProjectId);
        Store.dispatch('SET_CURRENT_BUILD', newBuild);
      } catch (err) {
        setBuildLogs(prev => [...prev, `Error: ${err.message}`]);
      }
    };

    const handleFileSelect = (path) => {
      setSelectedFile({ path, content: '' });
    };

    const handleMouseDown = (e) => {
      e.preventDefault();
      isResizing.current = true;
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
    };

    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 600) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
    };

    const tabs = [
      { id: 'files', label: t.ws?.fileTree || 'Files', icon: 'folder', badge: fileTree?.length },
      { id: 'build', label: t.ws?.buildLog || 'Build', icon: 'terminal' },
      { id: 'artifacts', label: t.nav?.artifacts || 'Artifacts', icon: 'box' },
    ];

    return (
      <aside
        style={{ width: `${width}px` }}
        className="relative border-l border-border bg-surface flex flex-col shrink-0 overflow-hidden"
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-mc transition-colors z-30"
          onMouseDown={handleMouseDown}
        />
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
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
                    <h4 className={cx.sectionTitle}>{t.ws?.fileTree || 'Files'}</h4>
                    <button
                      className={cx.btnIcon}
                      onClick={() => api.project(activeProjectId).then(p => Store.dispatch('SET_FILE_TREE', p.files || [])).catch(() => {})}
                    >
                      <Icon name="refresh" className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className={cx.j("overflow-auto transition-all", selectedFile ? "h-1/3 border-b border-border" : "flex-1")}>
                    {fileTree && fileTree.length > 0 ? (
                      <FileTreeView files={fileTree} onSelect={handleFileSelect} t={t} />
                    ) : (
                      <div className="py-20">
                        <EmptyState icon="folder" title={t.common?.empty || "No files"} description="Files will appear after project generation." />
                      </div>
                    )}
                  </div>

                  {selectedFile && (
                    <div className="flex-1 overflow-hidden flex flex-col bg-bg/20">
                      <div className="flex items-center justify-between px-3 py-1 bg-surface border-b border-border shrink-0">
                        <span className="text-[10px] text-tx3 font-mono truncate">{selectedFile.path}</span>
                        <button onClick={() => setSelectedFile(null)} className="text-tx3 hover:text-tx1 p-1">
                          <Icon name="close" className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <FilePreviewPane file={selectedFile} t={t} />
                      </div>
                    </div>
                  )}
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
                      data-testid="start-build-btn"
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
