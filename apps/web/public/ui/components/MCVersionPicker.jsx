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
