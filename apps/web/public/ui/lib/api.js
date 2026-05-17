// Tiny fetch wrapper with error normalization + EventSource helper for SSE
window.MCFL = window.MCFL || {};
window.MCFL.api = (() => {
  const base = "";

  async function request(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(base + url, opts);
    const ctype = r.headers.get("content-type") || "";
    const isJson = ctype.includes("application/json");
    const data = isJson ? await r.json().catch(() => null) : null;
    if (!r.ok) {
      const msg = (data && (data.error || data.message)) || `HTTP ${r.status}`;
      const err = new Error(msg);
      err.status = r.status;
      err.code = data && data.code;
      throw err;
    }
    return data;
  }

  // Open an EventSource and dispatch JSON-decoded events to the callback.
  // Returns the EventSource so the caller can close() it.
  function stream(url, onEvent) {
    const es = new EventSource(base + url);
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed);
      } catch { /* ignore malformed event */ }
    };
    es.onerror = () => {
      try { onEvent({ type: "error" }); } catch { /* ignore */ }
    };
    return es;
  }

  return {
    get: (url) => request("GET", url),
    post: (url, body) => request("POST", url, body ?? {}),
    patch: (url, body) => request("PATCH", url, body ?? {}),
    del: (url) => request("DELETE", url),
    stream,

    // Projects
    health: () => request("GET", "/api/health"),
    projects: () => request("GET", "/api/projects"),
    project: (id) => request("GET", `/api/projects/${id}`),
    createProject: (body) => request("POST", "/api/projects", body),
    deleteProject: (id) => request("DELETE", `/api/projects/${id}`),

    // Artifacts
    artifacts: (projectId) => request("GET", `/api/projects/${projectId}/artifacts`),
    deleteArtifact: (projectId, artifactId) => request("DELETE", `/api/projects/${projectId}/artifacts/${artifactId}`),

    // AI Providers
    providers: () => request("GET", "/api/ai/providers"),
    createProvider: (body) => request("POST", "/api/ai/providers", body),
    updateProvider: (id, body) => request("PATCH", `/api/ai/providers/${id}`, body),
    deleteProvider: (id) => request("DELETE", `/api/ai/providers/${id}`),
    testProvider: (id) => request("POST", `/api/ai/providers/${id}/test`),

    // Workflows
    workflows: () => request("GET", "/api/ai/workflows"),
    workflowRuns: () => request("GET", "/api/ai/workflow-runs"),

    // Toolchains
    toolchainsDoctor: () => request("GET", "/api/toolchains/doctor"),

    // Builds
    builds: (projectId) => request("GET", `/api/projects/${projectId}/builds`),
    build: (projectId, buildId) => request("GET", `/api/projects/${projectId}/builds/${buildId}`),
    startBuild: (projectId, body) => request("POST", `/api/projects/${projectId}/builds`, body ?? {}),
    streamBuild: (projectId, buildId, onEvent) =>
      stream(`/api/projects/${projectId}/builds/${buildId}/stream`, onEvent),
  };
})();
