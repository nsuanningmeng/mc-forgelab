// Centralized className recipes — single source of truth for styling
window.MCFL = window.MCFL || {};
window.MCFL.cx = (() => {
  // join helper
  const j = (...xs) => xs.filter(Boolean).join(" ");

  // Cards / surfaces
  const card = "bg-surface border border-border rounded-md";
  const cardElevated = "bg-elevated border border-border rounded-md";
  const cardPad = "p-4";
  const sectionTitle = "text-2xs font-semibold tracking-wider text-tx2 uppercase mb-2";

  // Inputs
  const input = "w-full bg-bg border border-border rounded-md px-3 py-2 text-sm text-tx1 placeholder:text-tx3 focus:outline-none focus:border-mc/60 focus:ring-1 focus:ring-mc/30 transition-colors";
  const select = input + " pr-8 appearance-none";
  const textarea = "w-full bg-bg border border-border rounded-md px-3 py-2.5 text-sm text-tx1 placeholder:text-tx3 focus:outline-none focus:border-mc/60 focus:ring-1 focus:ring-mc/30 transition-colors resize-y";
  const label = "block text-2xs font-semibold tracking-wider text-tx2 uppercase mb-1.5";

  // Buttons
  const btnBase = "inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none";
  const btnPrimary = j(btnBase, "bg-mc/15 text-mc border border-mc/30 hover:bg-mc/25 hover:border-mc/50");
  const btnSecondary = j(btnBase, "bg-elevated text-tx1 border border-border hover:border-tx2/40");
  const btnGhost = j(btnBase, "text-tx2 hover:text-tx1 hover:bg-elevated border border-transparent");
  const btnDanger = j(btnBase, "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20");
  const btnIcon = j(btnBase, "w-8 px-0 text-tx2 hover:text-tx1 hover:bg-elevated border border-transparent");

  // Nav items
  const navItem = "flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-md text-tx2 hover:text-tx1 hover:bg-elevated transition-colors";
  const navItemActive = "flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-md text-tx1 bg-elevated border-l-2 border-mc pl-2";

  // Chips (compact pill)
  const chip = "inline-flex items-center gap-1 h-6 px-2 rounded-md text-2xs font-medium border";
  const chipNeutral = j(chip, "bg-elevated border-border text-tx2");
  const chipActive = j(chip, "bg-mc/10 border-mc/40 text-mc");

  // Status badges
  const badge = "inline-flex items-center gap-1 h-5 px-1.5 rounded text-2xs font-semibold uppercase tracking-wider border";
  const badges = {
    success: j(badge, "bg-mc/10 text-mc border-mc/30"),
    info:    j(badge, "bg-blue/10 text-blue border-blue/30"),
    warn:    j(badge, "bg-warn/10 text-warn border-warn/30"),
    danger:  j(badge, "bg-danger/10 text-danger border-danger/30"),
    neutral: j(badge, "bg-elevated text-tx2 border-border"),
    planned: j(badge, "bg-elevated text-tx3 border-border"),
  };

  // Tables
  const tableWrap = "border border-border rounded-md overflow-hidden";
  const tableHead = "bg-elevated text-tx2 text-2xs uppercase tracking-wider";
  const tableTh = "px-3 py-2 text-left font-semibold";
  const tableTd = "px-3 py-2 text-sm text-tx1 border-t border-border/60";
  const tableRow = "hover:bg-elevated/60 transition-colors";

  // Misc
  const divider = "h-px bg-border";
  const link = "text-blue hover:underline";
  const mono = "mcfl-mono";

  return {
    j,
    card, cardElevated, cardPad, sectionTitle,
    input, select, textarea, label,
    btnPrimary, btnSecondary, btnGhost, btnDanger, btnIcon,
    navItem, navItemActive,
    chip, chipNeutral, chipActive,
    badges,
    tableWrap, tableHead, tableTh, tableTd, tableRow,
    divider, link, mono,
  };
})();
