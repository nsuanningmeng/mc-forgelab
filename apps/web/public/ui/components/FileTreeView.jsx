window.MCFL = window.MCFL || {};
(function () {
  const { useState, useMemo } = React;
  const { cx, Icon, EmptyState } = window.MCFL;

  function FileTreeView({ files, activePath, onSelect, t }) {
    const [expanded, setExpanded] = useState({ "/": true });

    const tree = useMemo(() => {
      if (!Array.isArray(files) || files.length === 0) return null;
      const root = { name: "root", type: "folder", children: {}, path: "" };
      
      files.forEach(f => {
        const parts = f.path.split("/").filter(Boolean);
        let curr = root;
        parts.forEach((part, i) => {
          if (i === parts.length - 1) {
            curr.children[part] = { name: part, type: "file", path: f.path, content: f.content };
          } else {
            if (!curr.children[part]) {
              curr.children[part] = { name: part, type: "folder", children: {}, path: parts.slice(0, i+1).join("/") };
            }
            curr = curr.children[part];
          }
        });
      });
      return root;
    }, [files]);

    if (!tree) {
      return (
        <div className="py-8">
          <EmptyState icon="folder" title={t.common.empty} description={t.ws.fileTree} />
        </div>
      );
    }

    const toggle = (path) => {
      setExpanded(prev => ({ ...prev, [path]: !prev[path] }));
    };

    const renderNode = (node, depth = 0) => {
      const isFolder = node.type === "folder";
      const isExpanded = expanded[node.path] || (depth === 0 && expanded["/"]);
      const isActive = activePath === node.path;

      return (
        <div key={node.path || "root"}>
          {node.name !== "root" && (
            <div
              onClick={() => isFolder ? toggle(node.path) : onSelect(node.path)}
              className={cx.j(
                "flex items-center gap-2 px-2 py-1 text-xs cursor-pointer rounded hover:bg-elevated transition-colors",
                isActive ? "bg-elevated text-mc font-medium" : "text-tx2"
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <Icon 
                name={isFolder ? (isExpanded ? "folder-open" : "folder") : "file"} 
                className={cx.j("w-3.5 h-3.5", isFolder ? "text-blue" : "text-tx3")}
              />
              <span className="truncate">{node.name}</span>
            </div>
          )}
          {isFolder && isExpanded && (
            <div>
              {Object.values(node.children)
                .sort((a, b) => {
                  if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
                  return a.name.localeCompare(b.name);
                })
                .map(child => renderNode(child, node.name === "root" ? 0 : depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="mcfl-mono py-1 select-none">
        {renderNode(tree)}
      </div>
    );
  }

  window.MCFL.FileTreeView = FileTreeView;
})();
