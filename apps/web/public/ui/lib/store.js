window.MCFL = window.MCFL || {};
(function () {
  const { api } = window.MCFL;

  class Store {
    constructor() {
      this.state = {
        messages: [],
        activeProjectId: null,
        activeProject: null,
        activeWorkflowId: 'simple-single-model',
        streamingMessage: null,
        workflowStatus: 'idle',
        fileTree: [],
        currentBuild: null,
        workflows: [],
        projects: [],
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
        case 'SET_PROJECTS':
          this.state.projects = payload;
          if (!this.state.activeProjectId && payload.length > 0) {
            this.state.activeProjectId = payload[0].id;
            this.state.activeProject = payload[0];
          }
          break;
        case 'SET_PROJECT':
          this.state.activeProjectId = payload?.id || null;
          this.state.activeProject = payload;
          break;
        case 'SET_ACTIVE_WORKFLOW':
          this.state.activeWorkflowId = payload;
          break;
        case 'ADD_MESSAGE':
          this.state.messages = [...this.state.messages, {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
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
          if (payload.length > 0 && !payload.find(w => w.id === this.state.activeWorkflowId)) {
            this.state.activeWorkflowId = payload[0].id;
          }
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
      this.dispatch('UPDATE_STREAMING', {
        role: 'assistant',
        type: 'text',
        content: '',
        status: 'streaming',
        step: 'Initializing...'
      });

      let currentText = '';

      const es = api.streamWorkflowRun(runId, (event) => {
        this._activeStream = es;
        switch (event.type) {
          case 'run_started':
            this.dispatch('SET_WORKFLOW_STATUS', 'running');
            break;

          case 'step_started':
            this.dispatch('UPDATE_STREAMING', {
              ...this.state.streamingMessage,
              step: `Step: ${event.stepId || 'Thinking...'}`,
              status: 'streaming'
            });
            break;

          case 'step_log':
            break;

          case 'model_delta':
            currentText += event.chunk || '';
            this.dispatch('UPDATE_STREAMING', {
              role: 'assistant',
              type: 'text',
              content: currentText,
              status: 'streaming',
              step: this.state.streamingMessage?.step || 'Generating...',
              timestamp: new Date().toISOString()
            });
            break;

          case 'step_finished':
            if (event.outputSummary && typeof event.outputSummary === 'string' && event.outputSummary.includes('```diff')) {
              this.dispatch('ADD_MESSAGE', {
                role: 'assistant',
                type: 'patch',
                content: event.outputSummary,
                stepId: event.stepId
              });
            }
            break;

          case 'run_finished':
            if (currentText) {
              this.dispatch('ADD_MESSAGE', { role: 'assistant', type: 'text', content: currentText });
            }
            this.dispatch('UPDATE_STREAMING', null);
            this.dispatch('SET_WORKFLOW_STATUS', event.status === 'success' ? 'success' : event.status);
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
