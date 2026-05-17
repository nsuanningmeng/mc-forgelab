// Tiny fetch wrapper with error normalization
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

  return {
    get: (url) => request("GET", url),
    post: (url, body) => request("POST", url, body ?? {}),
    del: (url) => request("DELETE", url),

    // typed helpers used by pages
    health: () => request("GET", "/api/health"),
    projects: () => request("GET", "/api/projects"),
    project: (id) => request("GET", `/api/projects/${id}`),
    createProject: (body) => request("POST", "/api/projects", body),
    deleteProject: (id) => request("DELETE", `/api/projects/${id}`),
    artifacts: (projectId) => request("GET", `/api/projects/${projectId}/artifacts`),
    deleteArtifact: (projectId, artifactId) => request("DELETE", `/api/projects/${projectId}/artifacts/${artifactId}`),
    providers: () => request("GET", "/api/ai/providers"),
    workflows: () => request("GET", "/api/ai/workflows"),
    workflowRuns: () => request("GET", "/api/ai/workflow-runs"),
  };
})();
