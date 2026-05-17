// ArtifactTable — IDE-style dense table for artifacts
window.MCFL = window.MCFL || {};
(function () {
  const { cx, Icon, StatusBadge } = window.MCFL;

  function formatSize(bytes) {
    if (bytes == null) return "—";
    const n = Number(bytes);
    if (!Number.isFinite(n) || n < 0) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function ArtifactTable({ artifacts = [], projectId, onDelete, onCopySha, t }) {
    if (artifacts.length === 0) return null;

    return (
      <div className={cx.tableWrap}>
        <table className="w-full text-sm">
          <thead className={cx.tableHead}>
            <tr>
              <th className={cx.tableTh}>{t.file}</th>
              <th className={cx.tableTh}>{t.type}</th>
              <th className={cx.j(cx.tableTh, "text-right")}>{t.size}</th>
              <th className={cx.tableTh}>{t.sha}</th>
              <th className={cx.tableTh}>{t.created}</th>
              <th className={cx.j(cx.tableTh, "text-right w-[1%]")}> </th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((a) => (
              <tr key={a.artifactId} className={cx.tableRow}>
                <td className={cx.j(cx.tableTd, "font-medium")}>
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name="file" className="w-4 h-4 text-tx3 shrink-0" />
                    <span className={cx.j("truncate", cx.mono)}>{a.fileName}</span>
                  </div>
                </td>
                <td className={cx.tableTd}>
                  <StatusBadge variant="neutral" label={a.type || "file"} dot={false} />
                </td>
                <td className={cx.j(cx.tableTd, "text-right", cx.mono, "text-tx2")}>{formatSize(a.fileSize)}</td>
                <td className={cx.tableTd}>
                  <code className="text-2xs text-tx3">{a.sha256 ? a.sha256.slice(0, 12) + "…" : "—"}</code>
                </td>
                <td className={cx.j(cx.tableTd, cx.mono, "text-2xs text-tx2")}>
                  {a.createdAt ? a.createdAt.slice(0, 19).replace("T", " ") : "—"}
                </td>
                <td className={cx.j(cx.tableTd, "text-right whitespace-nowrap")}>
                  <div className="inline-flex items-center gap-1">
                    {a.sha256 && (
                      <button
                        type="button"
                        title={t.copySha}
                        onClick={() => onCopySha && onCopySha(a.sha256)}
                        className={cx.btnIcon}
                      >
                        <Icon name="copy" className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <a
                      href={`/api/projects/${projectId}/artifacts/${a.artifactId}/download`}
                      className={cx.btnSecondary}
                      download
                    >
                      <Icon name="download" className="w-3.5 h-3.5" />
                    </a>
                    {onDelete && (
                      <button type="button" onClick={() => onDelete(a)} className={cx.btnIcon} title="Delete">
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  window.MCFL.ArtifactTable = ArtifactTable;
})();
