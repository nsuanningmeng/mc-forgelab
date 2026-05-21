window.MCFL = window.MCFL || {};
(function () {
  const { api } = window.MCFL;

  class Store {
    constructor() {
      this.state = {
        messages: [],
        activeProjectId: null,
        activeProject: null,
        streamingMessage: null,
        workflowStatus: 'idle',
        fileTree: [],
        currentBuild: null,
        workflows: [],
      };
      this.listeners = new Set();
      this._activeStream = null;
    }

    getState() {
      return this.state;
    }

    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    notify() {
      this.listeners.forEach((fn) => fn(this.state));
    }

    dispatch(action, payload) {
      switch (action) {
        case 'SET_PROJECT':
          this.state.activeProjectId = payload?.id || null;
          this.state.activeProject = payload;
          break;
        case 'ADD_MESSAGE':
          this.state.messages = [...this.state.messages, {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            ...payload
          }];
          break;
        case 'UPDATE_STREAMING':
          this.state.streamingMessage = payload;
          break;
        case 'SET_WORKFLOW_STATUS':
          this.state.workflowStatus = payload;
          break;
        case 'SET_WORKFLOWS':
          this.state.workflows = payload;
          break;
        case 'SET_FILE_TREE':
          this.state.fileTree = payload;
          break;
        default:
          console.warn('Unknown action:', action);
      }
      this.notify();
    }

    cancelStream() {
      if (this._activeStream) {
        this._activeStream.close();
        this._activeStream = null;
      }
    }

    async initWorkflowStream(runId) {
      this.cancelStream();
      this.dispatch('SET_WORKFLOW_STATUS', 'running');
      this.dispatch('UPDATE_STREAMING', { role: 'assistant', type: 'text', content: '', status: 'streaming' });

      let currentText = '';

      const es = api.streamWorkflowRun(runId, (event) => {
        this._activeStream = es;
        switch (event.type) {
          case 'model_delta':
            currentText += event.chunk || '';
            this.dispatch('UPDATE_STREAMING', {
              role: 'assistant',
              type: 'text',
              content: currentText,
              status: 'streaming',
              timestamp: new Date().toISOString()
            });
            break;
          case 'step_finished':
            if (event.outputSummary && typeof event.outputSummary === 'string' && event.outputSummary.includes('```diff')) {
              this.dispatch('ADD_MESSAGE', { role: 'assistant', type: 'patch', content: event.outputSummary });
            }
            break;
          case 'run_finished':
            if (currentText) {
              this.dispatch('ADD_MESSAGE', { role: 'assistant', type: 'text', content: currentText });
            }
            this.dispatch('UPDATE_STREAMING', null);
            this.dispatch('SET_WORKFLOW_STATUS', event.status || 'success');
            es.close();
            break;
          case 'error':
            this.dispatch('ADD_MESSAGE', { role: 'system', type: 'error', content: event.message || 'Workflow failed' });
            this.dispatch('UPDATE_STREAMING', null);
            this.dispatch('SET_WORKFLOW_STATUS', 'failed');
            es.close();
            break;
        }
      });

      return es;
    }
  }

  window.MCFL.Store = new Store();
})();
