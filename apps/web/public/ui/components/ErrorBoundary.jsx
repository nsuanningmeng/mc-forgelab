// ErrorBoundary — class component (function components can't catch render errors).
// Without this, any thrown render error unmounts the entire React tree and
// leaves the user with a blank black screen and no diagnostics.
window.MCFL = window.MCFL || {};
(function () {
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
      this.reset = this.reset.bind(this);
    }
    static getDerivedStateFromError(error) {
      return { error };
    }
    componentDidCatch(error, info) {
      // Surface for devtools; do not swallow.
      // eslint-disable-next-line no-console
      console.error("[MCFL] React render error:", error, info);
    }
    reset() {
      this.setState({ error: null });
    }
    render() {
      if (!this.state.error) return this.props.children;
      const msg = this.state.error && this.state.error.message
        ? this.state.error.message
        : String(this.state.error);
      const stack = this.state.error && this.state.error.stack ? this.state.error.stack : "";
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-8">
          <div className="max-w-2xl w-full bg-surface border border-danger/40 rounded-md p-6">
            <h2 className="text-base font-semibold text-danger mb-2">UI render error</h2>
            <p className="text-xs text-tx2 mb-3">
              The page crashed while rendering. The rest of the workbench is unaffected; click
              "Reset" to recover, or check the browser console for the stack trace.
            </p>
            <pre className="text-2xs text-tx1 bg-bg border border-border rounded p-3 overflow-auto max-h-[260px] whitespace-pre-wrap">
{msg}
{stack ? "\n\n" + stack : ""}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={this.reset}
                className="inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-mc/15 text-mc border border-mc/30 hover:bg-mc/25 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      );
    }
  }
  window.MCFL.ErrorBoundary = ErrorBoundary;
})();
