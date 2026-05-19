window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api } = window.MCFL;

  window.MCFL.targetsCache = window.MCFL.targetsCache || {};

  function MCVersionPicker({ targetId, value, onChange, t }) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (!targetId) {
        setVersions([]);
        return;
      }

      if (window.MCFL.targetsCache[targetId]) {
        setVersions(window.MCFL.targetsCache[targetId]);
        return;
      }

      setLoading(true);
      api.targetMcVersions(targetId)
        .then((list) => {
          window.MCFL.targetsCache[targetId] = list;
          setVersions(list);
        })
        .catch(() => setVersions([]))
        .finally(() => setLoading(false));
    }, [targetId]);

    // Group versions by major (e.g. 1.20.x, 1.19.x)
    const groups = versions.reduce((acc, v) => {
      const parts = v.version.split('.');
      const major = parts.length >= 2 ? `${parts[0]}.${parts[1]}.x` : 'Other';
      if (!acc[major]) acc[major] = [];
      acc[major].push(v);
      return acc;
    }, {});

    const selectedVer = versions.find(v => v.version === value);

    return (
      <div className="space-y-2">
        <div className="relative">
          <select
            className={cx.select}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={loading || !targetId}
          >
            <option value="" className="bg-surface text-tx1">{loading ? t.common.loading : `— Select ${t.proj.mcVersion} —`}</option>
            {Object.entries(groups).map(([label, list]) => (
              <optgroup key={label} label={label} className="bg-surface text-tx1 font-semibold">
                {list.map((v) => (
                  <option key={v.version} value={v.version} className="bg-surface text-tx1">
                    {v.version}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-tx3">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
          </div>
        </div>

        {selectedVer && (
          <div className="flex gap-4 text-2xs text-tx3 font-medium uppercase tracking-wider">
            {selectedVer.recommendedJava && (
              <div>{t.proj.recJava}: <span className="text-mc">Java {selectedVer.recommendedJava}</span></div>
            )}
            {(selectedVer.buildTool || selectedVer.recommendedBuildTool) && (
              <div>{t.proj.recBuildTool}: <span className="text-blue">{selectedVer.buildTool || selectedVer.recommendedBuildTool}</span></div>
            )}
          </div>
        )}
      </div>
    );
  }

  window.MCFL.MCVersionPicker = MCVersionPicker;
})();
