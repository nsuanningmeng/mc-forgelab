window.MCFL = window.MCFL || {};
(function () {
  const { MarkdownRenderer, cx, Icon } = window.MCFL;

  function FileCards({ files }) {
    const { useState } = React;
    const [expanded, setExpanded] = useState({});

    if (!Array.isArray(files) || files.length === 0) return null;

    const toggle = (idx) => setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-tx2 text-xs mb-2">
          <Icon name="file" className="w-3 h-3" />
          <span>{files.length} file{files.length > 1 ? 's' : ''} generated</span>
        </div>
        {files.map((f, idx) => (
          <div key={idx} className="border border-border/50 rounded-lg overflow-hidden bg-bg/50">
            <button
              onClick={() => toggle(idx)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-elevated/50 transition-colors text-left"
              aria-expanded={!!expanded[idx]}
            >
              <Icon name="chevronR" className={cx.j("w-3 h-3 text-tx3 transition-transform", expanded[idx] && "rotate-90")} />
              <span className={cx.j(
                "font-mono text-[11px] truncate flex-1",
                f.op === 'delete' ? 'text-red-400 line-through' : 'text-tx1'
              )}>
                {f.path}
              </span>
              <span className={cx.j(
                "text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight shrink-0",
                f.op === 'create' ? 'bg-green-500/10 text-green-500' :
                f.op === 'update' ? 'bg-blue-500/10 text-blue-500' :
                f.op === 'delete' ? 'bg-red-500/10 text-red-500' :
                'bg-elevated text-tx3'
              )}>
                {f.op}
              </span>
            </button>
            {expanded[idx] && f.content && (
              <div className="border-t border-border/30">
                <pre className="p-3 text-[11px] mcfl-mono bg-bg-log overflow-x-auto max-h-64 overflow-y-auto">
                  <code className="text-tx1">{f.content}</code>
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  const ROLE_NAMES = {
    zh: {
      requirement_analyst: '需求分析',
      architect: '架构设计',
      code_generator: '代码生成',
      code_reviewer: '代码审查',
      build_error_analyzer: '错误分析',
      auto_fixer: '自动修复',
      documentation_writer: '文档生成',
      final_summarizer: '最终总结',
      system_template_init: '模板初始化',
      system_apply_patch: '应用补丁',
      system_build: '项目构建',
      system_package: '打包产物',
      auto_fix_loop: '修复循环',
    },
    en: {
      requirement_analyst: 'Requirements',
      architect: 'Architecture',
      code_generator: 'Code Gen',
      code_reviewer: 'Code Review',
      build_error_analyzer: 'Error Analysis',
      auto_fixer: 'Auto Fix',
      documentation_writer: 'Docs',
      final_summarizer: 'Summary',
      system_template_init: 'Template Init',
      system_apply_patch: 'Apply Patch',
      system_build: 'Build',
      system_package: 'Package',
      auto_fix_loop: 'Fix Loop',
    }
  };

  function StepTimeline({ stepHistory }) {
    const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('mcfl.lang')) || 'zh';
    const names = ROLE_NAMES[lang] || ROLE_NAMES.zh;

    if (!Array.isArray(stepHistory) || stepHistory.length === 0) return null;

    return (
      <div className="mb-3 p-3 rounded-xl bg-elevated/50 border border-border/40">
        <div className="flex items-center gap-2 mb-2.5 text-xs text-tx2 font-medium">
          <Icon name="spark" className="w-3.5 h-3.5 text-mc" />
          <span>{lang === 'zh' ? '工作流步骤' : 'Workflow Steps'}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {stepHistory.map((s, i) => {
            const isRunning = s.status === 'running';
            const isDone = s.status === 'done';
            const isFailed = s.status === 'failed';
            const label = names[s.role] || s.stepId;

            return (
              <div key={i} className={cx.j(
                "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border transition-colors",
                isRunning ? "bg-mc/10 border-mc/40 text-mc" :
                isDone ? "bg-green-500/5 border-green-500/30 text-green-500" :
                isFailed ? "bg-red-500/5 border-red-500/30 text-red-500" :
                "bg-bg border-border/30 text-tx3"
              )}>
                {isRunning && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mc opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-mc"></span>
                  </span>
                )}
                {isDone && <Icon name="check" className="w-3 h-3" />}
                {isFailed && <Icon name="x" className="w-3 h-3" />}
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function MessageItem({ message, isStreaming }) {
    const { useState } = React;
    const [thinkingExpanded, setThinkingExpanded] = useState(false);
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const hasStepHistory = isStreaming && Array.isArray(message.stepHistory) && message.stepHistory.length > 0;
    const hasContent = message.content && typeof message.content === 'string' && message.content.length > 0;

    return (
      <div className={cx.j("flex w-full mb-6", isUser ? "justify-end" : "justify-start")}>
        <div className={cx.j("max-w-[85%] flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
          <div className={cx.j(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            isUser ? "bg-blue/20 text-blue" : isAssistant ? "bg-mc/20 text-mc" : "bg-elevated text-tx3"
          )}>
            <Icon name={isUser ? "user" : isAssistant ? "spark" : "info"} className="w-4 h-4" />
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            {hasStepHistory && (
              <StepTimeline stepHistory={message.stepHistory} />
            )}

            {message.type === 'files' ? (
              <FileCards files={message.content} />
            ) : message.type === 'patch' ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-tx2 text-xs mb-2">
                  <Icon name="file" className="w-3 h-3" />
                  <span>Patch suggested</span>
                </div>
                <MarkdownRenderer content={message.content} />
                <div className="flex gap-2 mt-3">
                  <button className={cx.btnPrimary}>Approve</button>
                  <button className={cx.btnSecondary}>Review</button>
                </div>
              </div>
            ) : message.type === 'error' ? (
              <div className="text-danger flex items-start gap-2 px-4 py-3">
                <Icon name="info" className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{message.content}</span>
              </div>
            ) : isStreaming ? (
              <div className="px-0 py-0">
                {hasContent && (
                  <div className="bg-transparent">
                    <button
                      onClick={() => setThinkingExpanded(!thinkingExpanded)}
                      className="flex items-center gap-1.5 text-[11px] text-tx3 hover:text-mc transition-colors px-1 py-0.5"
                    >
                      <Icon name="chevronR" className={cx.j("w-3 h-3 transition-transform", thinkingExpanded && "rotate-90")} />
                      <span>{(typeof localStorage !== 'undefined' && localStorage.getItem('mcfl.lang')) === 'en' ? 'View thinking...' : '查看思考过程...'}</span>
                    </button>
                    {thinkingExpanded && (
                      <div className="mt-1.5 p-3 rounded-lg bg-bg-log/50 border border-border/30 max-h-96 overflow-y-auto text-sm">
                        <MarkdownRenderer content={message.content} isStreaming={true} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : hasContent ? (
              <div className="px-4 py-3 rounded-2xl text-sm font-medium bg-transparent text-tx1">
                <MarkdownRenderer content={message.content} />
              </div>
            ) : null}

            <div className={cx.j("text-[10px] text-tx3 px-1", isUser ? "text-right" : "text-left")}>
              {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              {isStreaming && <span className="ml-2 animate-pulse">●</span>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.MCFL.MessageItem = MessageItem;
})();
