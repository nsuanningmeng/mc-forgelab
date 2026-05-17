// Toolchains — placeholder for JDK / Gradle / Maven detection
window.MCFL = window.MCFL || {};
(function () {
  const { cx, PageHeader, EmptyState, StatusBadge } = window.MCFL;

  function Toolchains({ t }) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <PageHeader
          title={t.tc.title}
          subtitle={t.tc.subtitle}
          badge={<StatusBadge variant="planned" label={t.planned} />}
        />

        <EmptyState
          icon="wrench"
          title={t.planned}
          description={t.tc.placeholderNotice}
          variant="planned"
        />

        <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { name: "JDK", desc: "Java 17 / 21 detection" },
            { name: "Gradle", desc: "Wrapper detection & cache" },
            { name: "Maven", desc: "Mirror & local repo" },
          ].map((it) => (
            <div key={it.name} className={cx.j(cx.card, cx.cardPad)}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-tx1">{it.name}</span>
                <StatusBadge variant="planned" label={t.planned} />
              </div>
              <p className="text-2xs text-tx3 mt-1">{it.desc}</p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  window.MCFL.Toolchains = Toolchains;
})();
