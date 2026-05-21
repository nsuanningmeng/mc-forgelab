window.MCFL = window.MCFL || {};
(function () {
  const { useState } = React;
  const { cx, Icon } = window.MCFL;

  function InspectorColumn({ t }) {
    const [activeTab, setActiveTab] = useState('files');

    const tabs = [
      { id: 'files', label: t.ws.fileTree, icon: 'folder' },
      { id: 'build', label: t.ws.buildLog, icon: 'terminal' },
      { id: 'artifacts', label: t.nav.artifacts, icon: 'box' },
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
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'files' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className={cx.sectionTitle}>{t.ws.fileTree}</h4>
                <button className={cx.btnIcon}><Icon name="refresh" className="w-3.5 h-3.5" /></button>
              </div>
              <div className="space-y-2 opacity-50">
                <div className="flex items-center gap-2 text-sm px-2 py-1"><Icon name="folder" className="w-4 h-4 text-blue" /> src</div>
                <div className="flex items-center gap-2 text-sm px-4 py-1"><Icon name="folder" className="w-4 h-4 text-blue" /> main</div>
                <div className="flex items-center gap-2 text-sm px-8 py-1"><Icon name="file" className="w-4 h-4 text-tx3" /> Plugin.java</div>
                <div className="flex items-center gap-2 text-sm px-2 py-1"><Icon name="file" className="w-4 h-4 text-tx3" /> build.gradle</div>
              </div>
              <div className="mt-8 text-center py-10 border-2 border-dashed border-border rounded-lg">
                <p className="text-xs text-tx3">{t.ws.previewSelectHint || "Select a file to preview"}</p>
              </div>
            </div>
          )}

          {activeTab === 'build' && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h4 className={cx.sectionTitle}>{t.ws.buildLog}</h4>
                <button className={cx.btnPrimary}>Start Build</button>
              </div>
              <div className="flex-1 bg-bg-log p-4 mcfl-mono text-xs overflow-y-auto text-tx2">
                <div className="text-mc mb-1">&gt; Initializing build system...</div>
                <div className="mb-1">Checking toolchains: Java 17, Gradle 8.2.1</div>
                <div className="mb-1">Scanning project structure...</div>
                <div className="animate-pulse">_</div>
              </div>
            </div>
          )}

          {activeTab === 'artifacts' && (
            <div className="p-4">
              <h4 className={cx.sectionTitle}>{t.nav.artifacts}</h4>
              <div className="text-center py-20 text-tx3 italic text-xs">
                No artifacts built yet.
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  }

  window.MCFL.InspectorColumn = InspectorColumn;
})();
