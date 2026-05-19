// ProjectCard — compact selectable project row
window.MCFL = window.MCFL || {};
(function () {
  const { cx, StatusBadge, Icon } = window.MCFL;

  function ProjectCard({ project, onSelect, selected, onDelete }) {
    const date = (project.created_at || "").slice(0, 10);
    
    const handleDelete = (e) => {
      e.stopPropagation();
      if (onDelete) onDelete(project);
    };

    return (
      <button
        type="button"
        onClick={() => onSelect && onSelect(project)}
        className={cx.j(
          "w-full text-left rounded-md border transition-colors px-3 py-2.5 flex items-center justify-between gap-3",
          selected
            ? "bg-elevated border-mc/40"
            : "bg-surface border-border hover:border-tx2/30 hover:bg-elevated/40"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-tx1 truncate">{project.name}</div>
          <div className="text-2xs text-tx2 mt-0.5 flex items-center gap-1.5">
            <StatusBadge variant="neutral" label={project.target_id} dot={false} />
            <span className={cx.mono}>{project.minecraft_version}</span>
            {project.build_tool && (
              <>
                <span className="text-tx3">·</span>
                <span className={cx.mono}>{project.build_tool}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={cx.j("text-2xs text-tx3", cx.mono)}>{date}</div>
          {onDelete && (
            <button 
              type="button" 
              onClick={handleDelete} 
              className={cx.btnIcon}
            >
              <Icon name="trash" className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </button>
    );
  }

  window.MCFL.ProjectCard = ProjectCard;
})();
