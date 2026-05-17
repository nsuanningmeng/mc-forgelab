// Minimal inline-SVG icon set. No external icon font / lib.
window.MCFL = window.MCFL || {};
(function () {
  const P = ({ d, fill }) => <path d={d} fill={fill || "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />;

  // 24x24 viewBox; stroke-based glyphs only.
  const G = {
    dashboard: <><P d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 9h8V3h-8z" /></>,
    cpu:       <><P d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /><P d="M6 6h12v12H6z" /><P d="M10 10h4v4h-4z" /></>,
    folder:    <><P d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5z" /></>,
    git:       <><P d="M6 3v18M18 3v8a4 4 0 0 1-4 4H6" /><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /></>,
    terminal:  <><P d="M4 6h16v12H4z" /><P d="M7 10l3 2-3 2M13 14h4" /></>,
    box:       <><P d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" /></>,
    wrench:    <><P d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 2 2 6-6a4 4 0 0 0 5.4-5.4l-2.4 2.4-2-2z" /></>,
    cog:       <><circle cx="12" cy="12" r="3" /><P d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.6 0 1 .5 1 1.1V11" /></>,
    plus:      <><P d="M12 5v14M5 12h14" /></>,
    play:      <><P d="M6 4l14 8-14 8z" fill="currentColor" /></>,
    refresh:   <><P d="M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4" /></>,
    copy:      <><P d="M9 9h11v11H9zM5 15V5h10" /></>,
    download:  <><P d="M12 4v12M6 12l6 6 6-6M4 20h16" /></>,
    trash:     <><P d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
    chevronR:  <><P d="M9 6l6 6-6 6" /></>,
    external:  <><P d="M14 4h6v6M20 4l-9 9M19 13v6H5V5h6" /></>,
    sun:       <><circle cx="12" cy="12" r="4" /><P d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></>,
    globe:     <><circle cx="12" cy="12" r="9" /><P d="M3 12h18M12 3a14 14 0 0 1 0 18A14 14 0 0 1 12 3z" /></>,
    cube:      <><P d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" /></>,
    spark:     <><P d="M12 4v6M12 14v6M4 12h6M14 12h6" /></>,
    info:      <><circle cx="12" cy="12" r="9" /><P d="M12 8h.01M11 12h1v5h1" /></>,
    file:      <><P d="M14 3H6v18h12V8z M14 3v5h5" /></>,
    check:     <><P d="M5 12l5 5L20 7" /></>,
  };

  function Icon({ name, className = "w-4 h-4", title }) {
    const glyph = G[name];
    if (!glyph) return null;
    return (
      <svg viewBox="0 0 24 24" className={className} role={title ? "img" : "presentation"} aria-label={title} aria-hidden={title ? undefined : true}>
        {glyph}
      </svg>
    );
  }
  window.MCFL.Icon = Icon;
})();
