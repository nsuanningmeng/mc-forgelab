window.MCFL = window.MCFL || {};
(function () {
  const { api } = window.MCFL;

  function t(key, fallback) {
    const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('mcfl.lang')) || 'zh';
    const langs = window.MCFL.LANGS || {};
    const dict = langs[lang] || langs.zh || {};
    const keys = key.split('.');
    let obj = dict;
    for (const k of keys) {
      if (!obj) return fallback;
      obj = obj[k];
    }
    return obj || fallback;
  }

  function extractFileOps(text) {
    if (!text || typeof text !== 'string') return null;

    // Try the root object format first: {"type":"file_patch","operations":[...]}
    const objMatch = text.match(/\{\s*"type"\s*:\s*"file_patch"[^}]*"operations"\s*:\s*(\[[\s\S]*?\}\s*\])\s*[,\}]/);
    if (objMatch) {
      try {
        const files = JSON.parse(objMatch[1]);
        if (Array.isArray(files) && files.length > 0 && files.every(f => f && typeof f.op === 'string' && typeof f.path === 'string')) {
          const startIdx = text.indexOf(objMatch[0]);
          const endIdx = startIdx + objMatch[0].length;
          return {
            before: text.slice(0, startIdx).trim(),
            files,
            after: text.slice(endIdx).trim()
          };
        }
      } catch (e) { /* fall through */ }
    }

    // Fallback: bare array [{ "op": ... }]
    const startIdx = text.search(/\[\s*\{\s*"op"\s*:\s*"(?:create|update|delete)"/);
    if (startIdx === -1) return null;

    let depth = 0;
    let inString = false;
    let esc = false;
    let endIdx = -1;
    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') {
        depth--;
        if (depth === 0) { endIdx = i + 1; break; }
      }
    }
    if (endIdx === -1) return null;

    try {
      const files = JSON.parse(text.slice(startIdx, endIdx));
      if (!Array.isArray(files) || !files.every(f => f && typeof f.op === 'string' && typeof f.path === 'string')) return null;
      return {
        before: text.slice(0, startIdx).trim(),
        files,
        after: text.slice(endIdx).trim()
      };
    } catch (e) {
      return null;
    }
  }

  class Store {
    constructor() {
      this.state = {
        messages: [],
        activeProjectId: null,
        activeProject: null,
        activeWorkflowId: 'simple-single-model',
        streamingMessage: null,
        workflowStatus: 'idle',
        stepHistory: [],
        fileTree: [],
        currentBuild: null,
        workflows: [],
        projects: [],
        artifacts: [],
      };
      this.listeners = new Set();
      this._activeStream = null;
    }

    _getStorageKey(projectId) {
      return `mcfl.chat.${projectId || 'default'}`;
    }

    _loadMessages(projectId) {
      const key = this._getStorageKey(projectId);
      try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        console.error('Failed to load chat history', e);
        return [];
      }
    }

    _saveMessages(projectId, messages) {
      const key = this._getStorageKey(projectId);
      const toSave = messages.slice(-100);
      try {
        localStorage.setItem(key, JSON.stringify(toSave));
      } catch (e) {
        console.error('Failed to save chat history', e);
      }
    }

    getState() {
      return this.state;
    }

    subscribe(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }

    notify() {
      this.listeners.forEach((fn) => fn({ ...this.state }));
    }

    dispatch(action, payload) {
      switch (action) {
        case 'SET_PROJECTS':
          this.state.projects = payload;
          if (!this.state.activeProjectId && payload.length > 0) {
            this.state.activeProjectId = payload[0].id;
            this.state.activeProject = payload[0];
            this.state.messages = this._loadMessages(this.state.activeProjectId);
          }
          break;
        case 'SET_PROJECT':
          this.state.activeProjectId = payload?.id || null;
          this.state.activeProject = payload;
          this.state.messages = this._loadMessages(this.state.activeProjectId);
          break;
        case 'SET_ACTIVE_WORKFLOW':
          this.state.activeWorkflowId = payload;
          break;
        case 'ADD_MESSAGE': {
          const newMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            ...payload
          };
          this.state.messages = [...this.state.messages, newMessage].slice(-100);
          this._saveMessages(this.state.activeProjectId, this.state.messages);
          break;
        }
        case 'CLEAR_MESSAGES':
          this.state.messages = [];
          this._saveMessages(this.state.activeProjectId, []);
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
        case 'SET_CURRENT_BUILD':
          this.state.currentBuild = payload;
          break;
        case 'SET_ARTIFACTS':
          this.state.artifacts = payload;
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
      this.state.stepHistory = [];
      this.dispatch('UPDATE_STREAMING', {
        role: 'assistant',
        type: 'text',
        content: '',
        status: 'streaming',
        step: t('ws.initializing', 'Initializing...')
      });

      let currentText = '';

      const es = api.streamWorkflowRun(runId, (event) => {
        this._activeStream = es;
        switch (event.type) {
          case 'run_started':
            this.dispatch('SET_WORKFLOW_STATUS', 'running');
            break;

          case 'step_started': {
            const entry = { stepId: event.stepId, role: event.role, status: 'running', summary: null };
            this.state.stepHistory = [...this.state.stepHistory, entry];
            this.dispatch('UPDATE_STREAMING', {
              ...this.state.streamingMessage,
              step: event.stepId,
              stepRole: event.role,
              stepHistory: this.state.stepHistory,
              status: 'streaming'
            });
            break;
          }

          case 'step_log':
            break;

          case 'model_delta':
            currentText += event.chunk || '';
            this.dispatch('UPDATE_STREAMING', {
              role: 'assistant',
              type: 'text',
              content: currentText,
              status: 'streaming',
              step: this.state.streamingMessage?.step,
              stepRole: this.state.streamingMessage?.stepRole,
              stepHistory: this.state.stepHistory,
              timestamp: new Date().toISOString()
            });
            break;

          case 'step_finished': {
            const idx = this.state.stepHistory.findIndex(s => s.stepId === event.stepId);
            if (idx >= 0) {
              this.state.stepHistory = this.state.stepHistory.map((s, i) =>
                i === idx ? { ...s, status: event.status === 'success' ? 'done' : 'failed', summary: event.outputSummary || null } : s
              );
            }
            if (event.outputSummary && typeof event.outputSummary === 'string' && event.outputSummary.includes('```diff')) {
              this.dispatch('ADD_MESSAGE', {
                role: 'assistant',
                type: 'patch',
                content: event.outputSummary,
                stepId: event.stepId
              });
            }
            break;
          }

          case 'run_finished':
            if (currentText) {
              const extracted = extractFileOps(currentText);
              if (extracted) {
                if (extracted.before) {
                  this.dispatch('ADD_MESSAGE', { role: 'assistant', type: 'text', content: extracted.before });
                }
                this.dispatch('ADD_MESSAGE', { role: 'assistant', type: 'files', content: extracted.files });
                if (extracted.after) {
                  const cleaned = extracted.after.replace(/^[}\]]?\s*/, '');
                  if (cleaned) {
                    this.dispatch('ADD_MESSAGE', { role: 'assistant', type: 'text', content: cleaned });
                  }
                }
              } else {
                this.dispatch('ADD_MESSAGE', { role: 'assistant', type: 'text', content: currentText });
              }
            }
            this.state.stepHistory = [];
            this.dispatch('UPDATE_STREAMING', null);
            this.dispatch('SET_WORKFLOW_STATUS', event.status === 'success' ? 'success' : event.status);
            es.close();
            break;

          case 'error':
            this.state.stepHistory = [];
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
