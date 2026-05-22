window.MCFL = window.MCFL || {};
(function () {
  const { useState, useEffect, useCallback } = React;
  const { cx, api, PageHeader, EmptyState, StatusBadge, Icon, ProviderForm, ModelProfileForm } = window.MCFL;

  function Section({ title, description, badge, children, "data-testid": testId }) {
    return (
      <section className={cx.j(cx.card, "px-4 py-3.5")} data-testid={testId}>
        <header className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-tx1">{title}</h2>
          {badge}
        </header>
        <p className="text-xs text-tx3 mb-3 leading-relaxed">{description}</p>
        <div className="text-xs text-tx2">{children}</div>
      </section>
    );
  }

  function ProviderRow({ p, t, onToggle, onDelete, onTest, busy }) {
    const tf = t.settings.providers;
    return (
      <div className="px-3 py-2.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-tx1 truncate">{p.displayName}</span>
            <StatusBadge variant={p.enabled ? "success" : "neutral"} label={p.enabled ? "enabled" : "off"} dot={false} />
            <StatusBadge variant={p.hasKey ? "info" : "warn"} label={p.hasKey ? tf.keyStored : tf.keyEmpty} dot={false} />
          </div>
          <div className={cx.j("text-2xs text-tx3 mt-0.5 truncate", cx.mono)}>
            {p.baseUrl} · {p.defaultModel}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onTest(p)} disabled={busy === p.id} className={cx.btnGhost} title={tf.test}>
            {busy === p.id ? tf.testing : tf.test}
          </button>
          <button onClick={() => onToggle(p)} className={cx.btnSecondary}>
            {p.enabled ? tf.disable : tf.enable}
          </button>
          <button onClick={() => onDelete(p)} className={cx.btnIcon} title={tf.delete}>
            <Icon name="trash" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  function ModelProfileRow({ row, providers, t, onDelete }) {
    const tf = t.settings.profiles;
    const provider = providers.find(p => p.id === row.providerId);
    return (
      <div className="px-3 py-2.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-tx1 truncate">{row.name}</span>
            <StatusBadge variant="info" label={tf.roleOptions[row.role] || row.role} dot={false} />
          </div>
          <div className={cx.j("text-2xs text-tx3 mt-0.5 truncate", cx.mono)}>
            {provider?.displayName || row.providerId} · {row.model} · T:{row.temperature}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button data-testid="delete-profile-btn" onClick={() => onDelete(row)} className={cx.btnIcon} title={tf.delete}>
            <Icon name="trash" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  function Settings({ t, lang, onSetLang, onSetTheme, theme }) {
    const [providers, setProviders] = useState(null);
    const [profiles, setProfiles] = useState(null);
    const [showProviderForm, setShowProviderForm] = useState(false);
    const [showProfileForm, setShowProfileForm] = useState(false);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [rotatingProvider, setRotatingProvider] = useState(null);
    const [newApiKey, setNewApiKey] = useState('');
    const [testResult, setTestResult] = useState(null);
    const [workspaceSettings, setWorkspaceSettings] = useState(null);
    const [editingWorkspace, setEditingWorkspace] = useState(false);
    const [wsDraft, setWsDraft] = useState({ workspacePath: '', maxArtifactStorageBytes: '', artifactRetentionDays: '' });
    const [proxySettings, setProxySettings] = useState(null);
    const [editingProxy, setEditingProxy] = useState(false);
    const [proxyDraft, setProxyDraft] = useState({ http: '', httpPort: '', https: '', httpsPort: '', username: '', password: '', noProxy: '' });

    const reload = useCallback(() => {
      setError(null);
      api.providers().then(setProviders).catch(() => setProviders([]));
      api.modelProfiles().then(setProfiles).catch(() => setProfiles([]));
      fetch('/api/settings/workspace').then(r => r.json()).then(data => {
        setWorkspaceSettings(data);
        setWsDraft({
          workspacePath: data.workspacePath || '',
          maxArtifactStorageBytes: String(Math.round((data.maxArtifactStorageBytes || 0) / (1024 * 1024 * 1024))),
          artifactRetentionDays: String(data.artifactRetentionDays || 30),
        });
      }).catch(() => setWorkspaceSettings(null));
      api.getProxy().then(data => {
        setProxySettings(data);
        setProxyDraft({
          http: data.http || '',
          httpPort: data.httpPort ? String(data.httpPort) : '',
          https: data.https || '',
          httpsPort: data.httpsPort ? String(data.httpsPort) : '',
          username: data.username || '',
          password: '', // sensitive
          noProxy: data.noProxy || '',
        });
      }).catch(() => setProxySettings(null));
    }, []);

    useEffect(reload, [reload]);

    const handleSaveProvider = async (body) => {
      await api.createProvider(body);
      setShowProviderForm(false);
      reload();
    };

    const handleSaveProfile = async (body) => {
      await api.createModelProfile(body);
      setShowProfileForm(false);
      reload();
    };

    const handleToggleProvider = async (p) => {
      try {
        await api.updateProvider(p.id, { enabled: !p.enabled });
        reload();
      } catch (err) {
        setError(err.message || String(err));
      }
    };

    const handleDeleteProvider = async (p) => {
      if (!window.confirm(t.settings.providers.confirmDelete)) return;
      try {
        await api.deleteProvider(p.id);
        reload();
      } catch (err) {
        setError(err.message || String(err));
      }
    };

    const handleDeleteProfile = async (row) => {
      if (!window.confirm(t.settings.profiles.confirmDelete)) return;
      try {
        await api.deleteModelProfile(row.id);
        reload();
      } catch (err) {
        setError(err.message || String(err));
      }
    };

    const handleRotateKey = async (p) => {
      if (!newApiKey.trim() || newApiKey.length < 4) {
        setError("API Key must be at least 4 characters");
        return;
      }
      setBusy(p.id);
      try {
        await api.updateProvider(p.id, { apiKey: newApiKey.trim() });
        setRotatingProvider(null);
        setNewApiKey('');
        reload();
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setBusy(null);
      }
    };

    const handleSaveWorkspace = async () => {
      const bytes = Number(wsDraft.maxArtifactStorageBytes) * 1024 * 1024 * 1024;
      const days = Number(wsDraft.artifactRetentionDays);
      if (!wsDraft.workspacePath.trim()) {
        setError("Workspace path cannot be empty");
        return;
      }
      if (!Number.isFinite(bytes) || bytes < 0) {
        setError("Storage quota must be a non-negative number (GB)");
        return;
      }
      if (!Number.isFinite(days) || days < 1) {
        setError("Retention days must be at least 1");
        return;
      }
      setBusy('workspace');
      try {
        const res = await fetch('/api/settings/workspace', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspacePath: wsDraft.workspacePath.trim(),
            maxArtifactStorageBytes: bytes,
            artifactRetentionDays: days,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to save');
        }
        const data = await res.json();
        setWorkspaceSettings(data);
        setEditingWorkspace(false);
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setBusy(null);
      }
    };

    const handleSaveProxy = async () => {
      setBusy('proxy');
      try {
        const body = {
          http: proxyDraft.http.trim() || null,
          httpPort: proxyDraft.httpPort ? Number(proxyDraft.httpPort) : null,
          https: proxyDraft.https.trim() || null,
          httpsPort: proxyDraft.httpsPort ? Number(proxyDraft.httpsPort) : null,
          username: proxyDraft.username.trim() || null,
          noProxy: proxyDraft.noProxy.trim() || null,
        };
        if (proxyDraft.password) body.password = proxyDraft.password;
        
        await api.updateProxy(body);
        const data = await api.getProxy();
        setProxySettings(data);
        setEditingProxy(false);
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setBusy(null);
      }
    };

    const handleTestProvider = async (p) => {
      setBusy(p.id);
      setTestResult(null);
      setError(null);
      try {
        const r = await api.testProvider(p.id);
        const ok = !!(r && (r.ok || r.success));
        setTestResult({ id: p.id, ok, message: r && (r.message || (ok ? t.settings.providers.testOk : t.settings.providers.testFail)) });
      } catch (err) {
        setTestResult({ id: p.id, ok: false, message: err.message || String(err) });
      } finally {
        setBusy(null);
      }
    };

    const tfp = t.settings.providers;
    const tfl = t.settings.profiles;
    const desc = t.settings.descriptions;

    return (
      <div className="p-6 max-w-[1100px] mx-auto">
        <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Section title={t.settings.groups.provider} description={desc.provider} data-testid="ai-providers-section">
            {error && <div className="mb-2 text-xs text-danger bg-danger/5 border border-danger/30 rounded-md px-3 py-2">{error}</div>}
            {testResult && <div className={cx.j("mb-2 text-xs px-3 py-2 rounded-md border", testResult.ok ? "text-mc bg-mc/5 border-mc/30" : "text-danger bg-danger/5 border-danger/30")}>{testResult.message}</div>}
            
            {providers === null ? (
              <span className="text-tx3">{t.common.loading}…</span>
            ) : providers.length === 0 && !showProviderForm ? (
              <EmptyState icon="cpu" title={tfp.empty} action={<button data-testid="add-provider-btn" onClick={() => setShowProviderForm(true)} className={cx.btnPrimary}><Icon name="plus" className="w-3.5 h-3.5" />{tfp.add}</button>} />
            ) : (
              <div className="space-y-2">
                {!showProviderForm && (
                  <div className="flex justify-end"><button data-testid="add-provider-btn" onClick={() => setShowProviderForm(true)} className={cx.btnPrimary}><Icon name="plus" className="w-3.5 h-3.5" />{tfp.add}</button></div>
                )}
                {showProviderForm && <ProviderForm t={t} mode="create" onSave={handleSaveProvider} onCancel={() => setShowProviderForm(false)} />}
                {providers.length > 0 && (
                  <div className={cx.j(cx.card, "divide-y divide-border")}>
                    {providers.map(p => <ProviderRow key={p.id} p={p} t={t} busy={busy} onToggle={handleToggleProvider} onDelete={handleDeleteProvider} onTest={handleTestProvider} />)}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title={t.settings.groups.models} description={desc.models} badge={<StatusBadge variant="success" label="active" dot={false} />} data-testid="model-profiles-section">
            {profiles === null ? (
              <span className="text-tx3">{t.common.loading}…</span>
            ) : profiles.length === 0 && !showProfileForm ? (
              <EmptyState icon="box" title={tfl.empty} action={<button data-testid="add-profile-btn" onClick={() => setShowProfileForm(true)} className={cx.btnPrimary}><Icon name="plus" className="w-3.5 h-3.5" />{tfl.add}</button>} />
            ) : (
              <div className="space-y-2">
                {!showProfileForm && (
                  <div className="flex justify-end"><button data-testid="add-profile-btn" onClick={() => setShowProfileForm(true)} className={cx.btnPrimary}><Icon name="plus" className="w-3.5 h-3.5" />{tfl.add}</button></div>
                )}
                {showProfileForm && (
                  <ModelProfileForm 
                    t={t} 
                    providers={providers || []} 
                    onSave={handleSaveProfile} 
                    onCancel={() => setShowProfileForm(false)} 
                  />
                )}
                {profiles.length > 0 && (
                  <div className={cx.j(cx.card, "divide-y divide-border")}>
                    {profiles.map(row => <ModelProfileRow key={row.id} row={row} providers={providers || []} t={t} onDelete={handleDeleteProfile} />)}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title={t.settings.groups.toolchains} description={desc.toolchains} badge={<StatusBadge variant="success" label="active" dot={false} />}>
            <div className="flex items-center gap-2">
              <Icon name="check" className="text-mc w-3.5 h-3.5" />
              <span>{t.tc?.subtitle || "JDK detection is live. CLI manages installs."}</span>
            </div>
          </Section>

          <Section title={t.settings.groups.workspace} description={desc.workspace} badge={<StatusBadge variant="success" label={t.common.status || "active"} />} data-testid="workspace-section">
            {workspaceSettings === null ? (
              <span className="text-tx3">{t.settings.workspace?.loading || "Loading…"}</span>
            ) : editingWorkspace ? (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-tx3 mb-1 block">{t.settings.workspace?.defaultPath || "Default Path"}</label>
                  <input
                    type="text"
                    value={wsDraft.workspacePath}
                    onChange={(e) => setWsDraft({ ...wsDraft, workspacePath: e.target.value })}
                    className={cx.j(cx.input, "w-full")}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-tx3 mb-1 block">{t.settings.workspace?.quota || "Storage Quota"} (GB)</label>
                    <input
                      type="number"
                      min="0"
                      value={wsDraft.maxArtifactStorageBytes}
                      onChange={(e) => setWsDraft({ ...wsDraft, maxArtifactStorageBytes: e.target.value })}
                      className={cx.j(cx.input, "w-full")}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-tx3 mb-1 block">{t.settings.workspace?.retention || "Artifact Retention"} (days)</label>
                    <input
                      type="number"
                      min="1"
                      value={wsDraft.artifactRetentionDays}
                      onChange={(e) => setWsDraft({ ...wsDraft, artifactRetentionDays: e.target.value })}
                      className={cx.j(cx.input, "w-full")}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingWorkspace(false)} className={cx.btnGhost}>{t.common?.cancel || "Cancel"}</button>
                  <button onClick={handleSaveWorkspace} disabled={busy === 'workspace'} className={cx.btnPrimary}>
                    {busy === 'workspace' ? (t.common?.saving || "Saving...") : (t.common?.save || "Save")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between">
                  <span>{t.settings.workspace?.defaultPath || "Default Path"}</span>
                  <span className={cx.mono}>{workspaceSettings.workspacePath || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.settings.workspace?.quota || "Storage Quota"}</span>
                  <span>{workspaceSettings.maxArtifactStorageBytes
                    ? `${(workspaceSettings.maxArtifactStorageBytes / (1024 * 1024 * 1024)).toFixed(0)} GB`
                    : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.settings.workspace?.retention || "Artifact Retention"}</span>
                  <span>{workspaceSettings.artifactRetentionDays
                    ? `${workspaceSettings.artifactRetentionDays} days`
                    : "—"}</span>
                </div>
                <div className="flex justify-end mt-1">
                  <button onClick={() => setEditingWorkspace(true)} className={cx.btnSecondary}>
                    {t.common?.edit || "Edit"}
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Section title={t.settings.groups.security} description={desc.security} data-testid="security-section">
            {providers === null ? (
              <span className="text-tx3">{t.common.loading}…</span>
            ) : providers.length === 0 ? (
              <span className="text-tx3">{t.common?.noProviders || "No providers configured"}</span>
            ) : (
              <div className="space-y-2">
                {providers.map(p => (
                  <div key={p.id} className="px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-tx1">{p.displayName}</span>
                        <StatusBadge variant={p.hasKey ? "success" : "warn"} label={p.hasKey ? "Key stored" : "No key"} dot={false} />
                      </div>
                      <button onClick={() => { setRotatingProvider(p.id); setNewApiKey(''); }} className={cx.btnSecondary}>
                        Rotate Key
                      </button>
                    </div>
                    {rotatingProvider === p.id && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="password"
                          value={newApiKey}
                          onChange={(e) => setNewApiKey(e.target.value)}
                          placeholder={t.common?.keyPlaceholder || "Enter new API Key"}
                          className={cx.j(cx.input, "flex-1")}
                          autoFocus
                        />
                        <button onClick={() => handleRotateKey(p)} disabled={busy === p.id} className={cx.btnPrimary}>{busy === p.id ? "Saving..." : "Save"}</button>
                        <button onClick={() => { setRotatingProvider(null); setNewApiKey(''); }} className={cx.btnGhost}>Cancel</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={t.settings.groups.proxy} description={desc.proxy} data-testid="proxy-section">
            {proxySettings === null ? (
              <span className="text-tx3">{t.common.loading}…</span>
            ) : editingProxy ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-2xs text-tx3 mb-1 block">{t.settings.proxy.httpProxy}</label>
                    <input type="text" value={proxyDraft.http} onChange={e => setProxyDraft({...proxyDraft, http: e.target.value})} className={cx.j(cx.input, "w-full")} placeholder="proxy.example.com" />
                  </div>
                  <div>
                    <label className="text-2xs text-tx3 mb-1 block">{t.settings.proxy.httpPort}</label>
                    <input type="number" value={proxyDraft.httpPort} onChange={e => setProxyDraft({...proxyDraft, httpPort: e.target.value})} className={cx.j(cx.input, "w-full")} placeholder="8080" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="text-2xs text-tx3 mb-1 block">{t.settings.proxy.httpsProxy}</label>
                    <input type="text" value={proxyDraft.https} onChange={e => setProxyDraft({...proxyDraft, https: e.target.value})} className={cx.j(cx.input, "w-full")} placeholder="proxy.example.com" />
                  </div>
                  <div>
                    <label className="text-2xs text-tx3 mb-1 block">{t.settings.proxy.httpsPort}</label>
                    <input type="number" value={proxyDraft.httpsPort} onChange={e => setProxyDraft({...proxyDraft, httpsPort: e.target.value})} className={cx.j(cx.input, "w-full")} placeholder="8443" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs text-tx3 mb-1 block">{t.settings.proxy.username}</label>
                    <input type="text" value={proxyDraft.username} onChange={e => setProxyDraft({...proxyDraft, username: e.target.value})} className={cx.j(cx.input, "w-full")} />
                  </div>
                  <div>
                    <label className="text-2xs text-tx3 mb-1 block">{t.settings.proxy.password}</label>
                    <input type="password" value={proxyDraft.password} onChange={e => setProxyDraft({...proxyDraft, password: e.target.value})} className={cx.j(cx.input, "w-full")} placeholder="******" />
                  </div>
                </div>
                <div>
                  <label className="text-2xs text-tx3 mb-1 block">{t.settings.proxy.noProxy}</label>
                  <textarea value={proxyDraft.noProxy} onChange={e => setProxyDraft({...proxyDraft, noProxy: e.target.value})} className={cx.j(cx.input, "w-full h-16 resize-none")} placeholder="localhost, 127.0.0.1, .internal.company.com" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setEditingProxy(false)} className={cx.btnGhost}>{t.common.cancel}</button>
                  <button onClick={handleSaveProxy} disabled={busy === 'proxy'} className={cx.btnPrimary}>
                    {busy === 'proxy' ? t.common.saving : t.common.save}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-tx3">{t.settings.proxy.httpProxy}</span>
                  <span className={cx.mono}>{proxySettings.http ? `${proxySettings.http}:${proxySettings.httpPort || '80'}` : t.settings.proxy.notConfigured}</span>
                </div>
                {proxySettings.https && (
                  <div className="flex justify-between items-center">
                    <span className="text-tx3">{t.settings.proxy.httpsProxy}</span>
                    <span className={cx.mono}>{proxySettings.https}:{proxySettings.httpsPort || '443'}</span>
                  </div>
                )}
                {proxySettings.username && (
                  <div className="flex justify-between items-center">
                    <span className="text-tx3">{t.settings.proxy.auth}</span>
                    <span className="text-tx2">{proxySettings.username} {proxySettings.password ? '***' : ''}</span>
                  </div>
                )}
                {proxySettings.noProxy && (
                  <div className="mt-1">
                    <span className="text-2xs text-tx3 block mb-0.5">{t.settings.proxy.noProxy}</span>
                    <div className="text-2xs text-tx2 bg-bg2 rounded px-2 py-1.5 break-all line-clamp-2">{proxySettings.noProxy}</div>
                  </div>
                )}
                <div className="flex justify-end mt-1">
                  <button onClick={() => setEditingProxy(true)} className={cx.btnSecondary}>
                    {t.common.edit}
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Section title={t.settings.groups.appearance} description={desc.appearance}>
            <div className="flex items-center justify-between mb-3">
              <span>{t.settings.language}</span>
              <div className="flex items-center gap-1">
                {["zh", "en"].map((l) => (
                  <button key={l} type="button" onClick={() => onSetLang(l)} className={lang === l ? cx.chipActive : cx.chipNeutral}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span>{t.settings.theme}</span>
              <div className="flex items-center gap-1">
                <button type="button" data-testid="theme-system" onClick={() => onSetTheme('system')} className={theme === 'system' ? cx.chipActive : cx.chipNeutral}>{t.settings.system}</button>
                <button type="button" data-testid="theme-dark" onClick={() => onSetTheme('dark')} className={theme === 'dark' ? cx.chipActive : cx.chipNeutral}>{t.settings.dark}</button>
                <button type="button" data-testid="theme-light" onClick={() => onSetTheme('light')} className={theme === 'light' ? cx.chipActive : cx.chipNeutral}>{t.settings.light}</button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    );
  }

  window.MCFL.Settings = Settings;
})();
