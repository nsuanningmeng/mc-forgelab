// PageHeader — page title, subtitle, and right-aligned actions
window.MCFL = window.MCFL || {};
(function () {
  const { cx } = window.MCFL;

  function PageHeader({ title, subtitle, badge, actions }) {
    return (
      <header className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-tx1 tracking-tight">{title}</h1>
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-tx2 mt-1 leading-relaxed">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </header>
    );
  }

  window.MCFL.PageHeader = PageHeader;
})();
