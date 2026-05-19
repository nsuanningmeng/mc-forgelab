window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect } = React;
  const { cx, api } = window.MCFL;

  // Known Minecraft versions. Mirrored from
  // apps/web/src/routes/targets.ts KNOWN_MC_VERSIONS so the picker
  // works the moment the form opens — without waiting for a target
  // selection. Keep these in sync; the backend still validates the
  // chosen value when a project is created.
  const KNOWN_VERSIONS = [
    "1.16.5", "1.17.1", "1.18.2", "1.19.4",
    "1.20.1", "1.20.2", "1.20.4", "1.20.6",
    "1.21", "1.21.1", "1.21.3", "1.21.4"
  ];

  function javaForMcVersion(version) {
    const [maj, min] = version.split(".").map((n) => parseInt(n, 10));
    if (maj !== 1 || isNaN(min)) return 21;
    if (min <= 16) return 8;
    if (min === 17) return 16;
    if (min >= 18 && min <= 20) return 17;
    return 21;
  }

  function gradleForMcVersion(version) {
    const [, min] = version.split(".").map((n) => parseInt(n, 10));
    if (!isFinite(min)) return "8.10";
    if (min >= 21) return "8.10";
    if (min >= 20) return "8.7";
    if (min >= 18) return "7.6";
    return "7.5";
  }

  window.MCFL.targetsCache = window.MCFL.targetsCache || {};

  function MCVersionPicker({ targetId, value, onChange, t }) {
    const [versions, setVersions] = useState(
      KNOWN_VERSIONS.map((v) => ({
        version: v,
        recommendedJava: javaForMcVersion(v),
        recommendedGradle: gradleForMcVersion(v),
        buildTool: "gradle",
      }))
    );

    // When a target is picked, refine the list with target-specific
    // floors and Gradle hints. The picker remains fully usable even
    // before that — we just show the universal known versions.
    useEffect(() => {
      if (!targetId) return;
      if (window.MCFL.targetsCache[targetId]) {
        setVersions(window.MCFL.targetsCache[targetId]);
        return;
      }
      api.targetMcVersions(targetId)
        .then((list) => {
          if (Array.isArray(list) && list.length > 0) {
            window.MCFL.targetsCache[targetId] = list;
            setVersions(list);
          }
        })
        .catch(() => { /* keep universal list on failure */ });
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
        >
          <option value="" className="bg-surface text-tx1">— Select {t.proj.mcVersion} —</option>
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
