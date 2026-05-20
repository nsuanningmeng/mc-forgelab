// ProjectCard — compact selectable project row
window.MCFL = window.MCFL || {};
(function () {
  const { cx, StatusBadge, Icon } = window.MCFL;

  function ProjectCard({ project, onSelect, selected, onDelete }) {
    const date = (project.created_at || "").slice(0, 10);

    const handleSelect = () => { if (onSelect) onSelect(project); };
    const handleSelectKey = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelect();
      }
    };
    const handleDelete = (e) => {
      e.stopPropagation();
      if (onDelete) onDelete(project);
    };

    // Outer element is a div with role="button" rather than a <button>
    // because the delete affordance is itself a nested <button>; placing
    // a button inside a button is invalid HTML and breaks click delivery
    // on some platforms.
    return (
      <div
        role="button"
        tabIndex={0}
        data-testid="project-card"
        onClick={handleSelect}
        onKeyDown={handleSelectKey}
        className={cx.j(
          "w-full text-left rounded-md border transition-colors px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-mc/50",
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
              data-testid="delete-project-btn"
              onClick={handleDelete}
              className={cx.btnIcon}
            >
              <Icon name="trash" className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  window.MCFL.ProjectCard = ProjectCard;
})();
