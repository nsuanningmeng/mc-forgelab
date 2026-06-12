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
        loadingMessages: false,
      };
      this.listeners = new Set();
      this._activeStream = null;
      this._migrationDone = localStorage.getItem('mcfl.migration.done') === '1';
      this._pendingSave = null;
      this._pendingSavePayload = null;
      // Saves are full-replace on the server, so they are only allowed once
      // history for the active project was loaded successfully — otherwise a
      // transient load failure + one new message would wipe stored history.
      this._messagesLoadedFor = null;
      this._pendingAdds = null;
      this._loadToken = 0;
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

    // ── Server-backed message persistence ─────────────────────────────────

    async _loadMessages(projectId) {
      if (!projectId || !api) return;
      this._messagesLoadedFor = null;
      this._loadToken += 1;
      const token = this._loadToken;
      this._pendingAdds = [];
      this.state.loadingMessages = true;
      this.notify();
      try {
        const msgs = await api.getMessages(projectId);
        // A newer load (project switch) superseded this one — drop the result.
        if (token !== this._loadToken || this.state.activeProjectId !== projectId) return;
        const adds = this._pendingAdds || [];
        this._pendingAdds = null;
        this.state.messages = (Array.isArray(msgs) ? msgs : []).concat(adds).slice(-200);
        this._messagesLoadedFor = projectId;
        if (adds.length > 0) this._saveMessages();
      } catch (e) {
        if (token !== this._loadToken) return;
        console.error('Failed to load messages from server', e);
        // Keep saves blocked (_messagesLoadedFor stays null) so a transient
        // load failure can never lead to overwriting stored history.
        this.state.messages = this._pendingAdds || [];
        this._pendingAdds = null;
      } finally {
        if (token === this._loadToken) {
          this.state.loadingMessages = false;
          this.notify();
        }
      }
    }

    _saveMessages() {
      if (!this.state.activeProjectId || !api) return;
      // Server sync is full-replace: never save before history was loaded.
      if (this._messagesLoadedFor !== this.state.activeProjectId) return;
      this._pendingSavePayload = { id: this.state.activeProjectId, msgs: this.state.messages };
      // Debounce: schedule save, only the latest call within 200ms wins
      if (this._pendingSave) clearTimeout(this._pendingSave);
      this._pendingSave = setTimeout(() => this._flushSave(), 200);
    }

    _flushSave() {
      if (this._pendingSave) {
        clearTimeout(this._pendingSave);
        this._pendingSave = null;
      }
      const payload = this._pendingSavePayload;
      this._pendingSavePayload = null;
      if (!payload || !api) return;
      api.syncMessages(payload.id, payload.msgs.slice(-200)).catch((e) => {
        console.error('Failed to save messages to server', e);
      });
    }

    async _migrateLocalStorage(projectId) {
      if (this._migrationDone || !api) return;
      // Scan all localStorage keys for old chat data
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('mcfl.chat.')) keys.push(k);
      }
      if (keys.length === 0) {
        localStorage.setItem('mcfl.migration.done', '1');
        this._migrationDone = true;
        return;
      }
      // Push each project's messages to the server
      let migrated = 0;
      for (const key of keys) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const msgs = JSON.parse(raw);
          if (!Array.isArray(msgs) || msgs.length === 0) continue;
          const pid = key.replace('mcfl.chat.', '');
          if (pid === 'default') continue;
          await api.syncMessages(pid, msgs.slice(-200));
          localStorage.removeItem(key);
          migrated++;
        } catch (e) {
          console.error('Migration failed for key ' + key, e);
        }
      }
      if (migrated > 0 && projectId) {
        // Reload messages for current project after migration
        await this._loadMessages(projectId);
      }
      localStorage.setItem('mcfl.migration.done', '1');
      this._migrationDone = true;
    }

    // ── Dispatch ─────────────────────────────────────────────────────────

    dispatch(action, payload) {
      switch (action) {
        case 'SET_PROJECTS':
          this.state.projects = payload;
          if (!this.state.activeProjectId && payload.length > 0) {
            this.state.activeProjectId = payload[0].id;
            this.state.activeProject = payload[0];
            this._migrateLocalStorage(this.state.activeProjectId).then(() =>
              this._loadMessages(this.state.activeProjectId)
            );
          }
          break;
        case 'SET_PROJECT': {
          const newId = payload?.id || null;
          if (newId !== this.state.activeProjectId) {
            // Persist the previous project's tail immediately, then detach
            // from its run stream so its events can't land in the new project.
            this._flushSave();
            this.cancelStream();
            this.state.streamingMessage = null;
            this.state.stepHistory = [];
            if (this.state.workflowStatus === 'running') this.state.workflowStatus = 'idle';
          }
          this.state.activeProjectId = newId;
          this.state.activeProject = payload;
          if (newId) {
            this._migrateLocalStorage(newId).then(() => this._loadMessages(newId));
          } else {
            this.state.messages = [];
          }
          break;
        }
        case 'SET_ACTIVE_WORKFLOW':
          this.state.activeWorkflowId = payload;
          break;
        case 'ADD_MESSAGE': {
          const newMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            ...payload
          };
          // While history is still loading, buffer the message so the load
          // result can merge it instead of replacing it.
          if (this.state.loadingMessages && this._pendingAdds) {
            this._pendingAdds.push(newMessage);
          }
          this.state.messages = [...this.state.messages, newMessage].slice(-200);
          this._saveMessages();
          break;
        }
        case 'CLEAR_MESSAGES':
          this.state.messages = [];
          this._saveMessages();
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
            // Most step logs are noise, but provider/toolchain warnings explain
            // why a run produced fake output or failed — surface those in chat.
            if (typeof event.line === 'string' && /^(WARNING:|Auto-fix aborted)/.test(event.line)) {
              this.dispatch('ADD_MESSAGE', { role: 'system', type: 'warning', content: event.line });
            }
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
            if (event.status !== 'success' && event.status !== 'canceled') {
              this.dispatch('ADD_MESSAGE', {
                role: 'system',
                type: 'error',
                content: event.errorMessage || t('ws.runFailed', 'Workflow run failed.')
              });
            }
            this.state.stepHistory = [];
            this.dispatch('UPDATE_STREAMING', null);
            this.dispatch('SET_WORKFLOW_STATUS', event.status === 'success' ? 'success' : event.status);
            es.close();
            break;

          case 'error':
            if (currentText) {
              this.dispatch('ADD_MESSAGE', { role: 'assistant', type: 'text', content: currentText });
            }
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
