window.MCFL = window.MCFL || {};
(function () {
  const { useMemo, useRef } = React;

  const inlineCache = new Map();
  function parseInline(text) {
    if (!text) return "";
    if (inlineCache.has(text)) return inlineCache.get(text);

    let parts = [text];

    parts = parts.flatMap(p => typeof p !== 'string' ? p : p.split(/(`[^`]+`)/g).map((s, i) => {
      if (s.startsWith('`') && s.endsWith('`')) {
        return <code key={`ic-${i}`} className="bg-elevated px-1 rounded text-mc font-mono">{s.slice(1, -1)}</code>;
      }
      return s;
    }));

    parts = parts.flatMap(p => typeof p !== 'string' ? p : p.split(/(\*\*[^\*]+\*\*)/g).map((s, i) => {
      if (s.startsWith('**') && s.endsWith('**')) {
        return <strong key={`b-${i}`}>{s.slice(2, -2)}</strong>;
      }
      return s;
    }));

    inlineCache.set(text, parts);
    return parts;
  }

  function highlightCode(code, lang) {
    if (!window.hljs) return { html: code, useHtml: false };
    try {
      if (lang && window.hljs.getLanguage(lang)) {
        return { html: window.hljs.highlight(code, { language: lang }).value, useHtml: true };
      } else if (!lang) {
        return { html: window.hljs.highlightAuto(code).value, useHtml: true };
      }
    } catch (e) { /* fallback to plain text */ }
    return { html: code, useHtml: false };
  }

  function MarkdownRenderer({ content, isStreaming }) {
    const cache = useRef({ paragraphs: [] });

    const rendered = useMemo(() => {
      if (!content) return null;

      let processedContent = content;
      if (isStreaming) {
        const codeBlockCount = (processedContent.match(/```/g) || []).length;
        if (codeBlockCount % 2 !== 0) {
          processedContent += '\n```';
        }
      }

      const lines = processedContent.split('\n');
      const elements = [];
      let currentBlock = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('```')) {
          if (currentBlock && currentBlock.type === 'code') {
            const code = currentBlock.lines.join('\n');
            const { html, useHtml } = highlightCode(code, currentBlock.lang);
            elements.push(
              <pre key={`cb-${elements.length}`} className="bg-bg-log p-3 rounded-md border border-border overflow-x-auto my-2 mcfl-mono text-xs">
                {useHtml ? (
                  <code className={`text-tx1 hljs ${currentBlock.lang || ''}`} dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <code className="text-tx1">{code}</code>
                )}
              </pre>
            );
            currentBlock = null;
          } else {
            currentBlock = { type: 'code', lang: line.slice(3).trim(), lines: [] };
          }
          continue;
        }

        if (currentBlock && currentBlock.type === 'code') {
          currentBlock.lines.push(line);
          continue;
        }

        if (line.match(/^[\*\-]\s/)) {
          elements.push(<li key={`li-${elements.length}`} className="ml-4 list-disc text-sm my-0.5">{parseInline(line.slice(2))}</li>);
          continue;
        }

        const headingMatch = line.match(/^(#{1,6})\s(.*)/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const Tag = `h${level}`;
          const sizeClass = level === 1 ? "text-xl font-bold" : level === 2 ? "text-lg font-bold" : "text-md font-bold";
          elements.push(<Tag key={`h-${elements.length}`} className={`${sizeClass} mt-4 mb-2`}>{parseInline(headingMatch[2])}</Tag>);
          continue;
        }

        if (line.trim() === '') {
          elements.push(<div key={`sp-${elements.length}`} className="h-2" />);
        } else {
          elements.push(<p key={`p-${elements.length}`} className="text-sm leading-relaxed mb-1">{parseInline(line)}</p>);
        }
      }

      if (currentBlock && currentBlock.type === 'code') {
        const code = currentBlock.lines.join('\n');
        const { html, useHtml } = highlightCode(code, currentBlock.lang);
        elements.push(
          <pre key={`cb-${elements.length}`} className="bg-bg-log p-3 rounded-md border border-border overflow-x-auto my-2 mcfl-mono text-xs">
            {useHtml ? (
              <code className={`text-tx1 hljs ${currentBlock.lang || ''}`} dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
              <code className="text-tx1">{code}</code>
            )}
          </pre>
        );
      }

      return elements;
    }, [content, isStreaming]);

    return <div className="markdown-body">{rendered}</div>;
  }

  window.MCFL.MarkdownRenderer = MarkdownRenderer;
})();
