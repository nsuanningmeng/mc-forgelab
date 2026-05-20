// CustomSelect — pure React dropdown replacing native <select>
// Fixes Win Chromium <option> styling issues (v0.3.7)
window.MCFL = window.MCFL || {};
(function () {
  const { useState, useRef, useEffect, useCallback, useMemo } = React;
  const { cx, Icon } = window.MCFL;

  function CustomSelect({ value, onChange, options, groups, placeholder, disabled, className, "data-testid": testId }) {
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const wrapRef = useRef(null);
    const listRef = useRef(null);

    const flat = useMemo(() => {
      if (groups) {
        const result = [];
        for (const g of groups) {
          for (const o of g.options) result.push(o);
        }
        return result;
      }
      return options || [];
    }, [options, groups]);

    const selected = useMemo(() => flat.find(o => o.value === value), [flat, value]);
    const hasSelection = value != null && value !== "";

    const close = useCallback(() => {
      setOpen(false);
      setActiveIdx(-1);
    }, []);

    const toggle = useCallback(() => {
      if (disabled) return;
      setOpen(prev => !prev);
    }, [disabled]);

    const selectAndClose = useCallback((val) => {
      onChange(val);
      close();
    }, [onChange, close]);

    // Click outside
    useEffect(() => {
      if (!open) return;
      const handler = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) close();
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open, close]);

    // Focus management
    useEffect(() => {
      if (!open) return;
      if (listRef.current) {
        listRef.current.focus();
        const idx = flat.findIndex(o => o.value === value);
        if (idx >= 0) {
          setActiveIdx(idx);
          const el = listRef.current.querySelector('[aria-selected="true"]');
          if (el) el.scrollIntoView({ block: "nearest" });
        }
      }
    }, [open, flat, value]);

    const handleKeyDown = useCallback((e) => {
      if (!open) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIdx(i => Math.min(i + 1, flat.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIdx(i => Math.max(i - 1, 0));
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (flat[activeIdx]) selectAndClose(flat[activeIdx].value);
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "Home":
          e.preventDefault();
          setActiveIdx(0);
          break;
        case "End":
          e.preventDefault();
          setActiveIdx(flat.length - 1);
          break;
      }
    }, [open, flat, activeIdx, selectAndClose, close]);

    const hasGroups = Array.isArray(groups);
    let globalIdx = -1;

    return (
      <div ref={wrapRef} className={cx.j("relative", className)} data-testid={testId}>
        <button
          type="button"
          data-testid={testId ? testId + "-trigger" : undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-disabled={disabled}
          disabled={disabled}
          onClick={toggle}
          onKeyDown={handleKeyDown}
          className={cx.j(
            cx.input,
            "flex items-center justify-between gap-2 cursor-pointer text-left",
            !hasSelection && "text-tx3",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="truncate">{selected ? selected.label : (placeholder || "Select...")}</span>
          <Icon name="chevron-down" className={cx.j("w-4 h-4 text-tx3 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        <input type="hidden" value={value || ""} tabIndex={-1} aria-hidden="true" />
        {open && (
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={activeIdx >= 0 ? "cs-opt-" + activeIdx : undefined}
            onKeyDown={handleKeyDown}
            className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-border bg-elevated shadow-lg focus:outline-none"
          >
            {!hasGroups && flat.map((opt) => {
              globalIdx++;
              const idx = globalIdx;
              const sel = opt.value === value;
              const act = idx === activeIdx;
              return (
                <li
                  key={String(opt.value)}
                  id={"cs-opt-" + idx}
                  role="option"
                  aria-selected={sel}
                  data-testid={opt.testId}
                  onClick={() => selectAndClose(opt.value)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={cx.j(
                    "px-3 py-2 text-sm cursor-pointer flex items-center justify-between",
                    sel ? "bg-mc/15 text-mc" : act ? "bg-elevated text-tx1" : "text-tx1"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {sel && <Icon name="check" className="w-3.5 h-3.5 text-mc shrink-0" />}
                </li>
              );
            })}
            {hasGroups && groups.map((group) => (
              <li key={group.label} role="group" className="list-none">
                <div className="px-3 py-1.5 text-2xs font-semibold tracking-wider text-tx2 uppercase bg-bg sticky top-0">
                  {group.label}
                </div>
                {group.options.map((opt) => {
                  globalIdx++;
                  const idx = globalIdx;
                  const sel = opt.value === value;
                  const act = idx === activeIdx;
                  return (
                    <li
                      key={String(opt.value)}
                      id={"cs-opt-" + idx}
                      role="option"
                      aria-selected={sel}
                      data-testid={opt.testId}
                      onClick={() => selectAndClose(opt.value)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={cx.j(
                        "px-3 py-2 pl-6 text-sm cursor-pointer flex items-center justify-between",
                        sel ? "bg-mc/15 text-mc" : act ? "bg-elevated text-tx1" : "text-tx1"
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {sel && <Icon name="check" className="w-3.5 h-3.5 text-mc shrink-0" />}
                    </li>
                  );
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  window.MCFL.CustomSelect = CustomSelect;
})();
