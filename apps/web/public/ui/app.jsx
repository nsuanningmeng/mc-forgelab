const { useState, useEffect, useCallback } = React;

// ── API helpers ──────────────────────────────────────────────────────────────
const api = {
  get: (url) => fetch(url).then(r => r.json()),
  post: (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url) => fetch(url, { method: "DELETE" }),
};

// ── Components ───────────────────────────────────────────────────────────────
function Sidebar({ page, setPage }) {
  const items = [
    { id: "dashboard", label: "仪表盘" },
    { id: "new-project", label: "新建项目" },
    { id: "download", label: "下载中心" },
  ];
  return (
    <aside className="w-48 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-2">
      <div className="text-green-400 font-bold text-sm mb-4">⚒ MC-AI-ForgeLab</div>
      {items.map(i => (
        <button key={i.id} onClick={() => setPage(i.id)}
          className={`text-left px-3 py-2 rounded text-sm ${page === i.id ? "bg-green-700 text-white" : "text-gray-400 hover:bg-gray-800"}`}>
          {i.label}
        </button>
      ))}
    </aside>
  );
}

function Dashboard({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.get("/api/projects").then(setProjects).catch(() => {});
    api.get("/api/health").then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">仪表盘</h1>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded p-4">
          <div className="text-2xl font-bold text-green-400">{projects.length}</div>
          <div className="text-sm text-gray-400">项目总数</div>
        </div>
        <div className="bg-gray-800 rounded p-4">
          <div className={`text-2xl font-bold ${health?.ok ? "text-green-400" : "text-red-400"}`}>{health?.ok ? "运行中" : "离线"}</div>
          <div className="text-sm text-gray-400">服务状态</div>
        </div>
        <div className="bg-gray-800 rounded p-4">
          <div className="text-2xl font-bold text-blue-400">{health?.version ?? "-"}</div>
          <div className="text-sm text-gray-400">版本</div>
        </div>
      </div>
      <h2 className="text-lg font-semibold mb-3">最近项目</h2>
      {projects.length === 0 ? (
        <p className="text-gray-500 text-sm">暂无项目，点击"新建项目"开始。</p>
      ) : (
        <div className="space-y-2">
          {projects.slice(0, 10).map(p => (
            <div key={p.id} onClick={() => onSelectProject(p)}
              className="bg-gray-800 rounded p-3 flex justify-between items-center cursor-pointer hover:bg-gray-700">
              <div>
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-gray-400">{p.target_id} · {p.minecraft_version}</div>
              </div>
              <div className="text-xs text-gray-500">{p.created_at?.slice(0, 10)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewProject({ onCreated }) {
  const [form, setForm] = useState({ name: "", targetId: "paper", minecraftVersion: "1.20.1", packageName: "com.example.plugin" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const p = await api.post("/api/projects", form);
      if (p.error) { setError(p.error); return; }
      onCreated(p);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const field = (label, key, placeholder) => (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" />
    </div>
  );

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-xl font-bold mb-4">新建项目</h1>
      <form onSubmit={submit} className="space-y-4">
        {field("项目名称", "name", "MyPlugin")}
        <div>
          <label className="block text-sm text-gray-400 mb-1">目标端</label>
          <select value={form.targetId} onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
            {["paper", "spigot", "purpur", "folia", "velocity", "fabric", "forge"].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {field("Minecraft 版本", "minecraftVersion", "1.20.1")}
        {field("包名", "packageName", "com.example.plugin")}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded py-2 text-sm font-medium">
          {loading ? "创建中..." : "创建项目"}
        </button>
      </form>
    </div>
  );
}

function DownloadCenter({ project }) {
  const [artifacts, setArtifacts] = useState([]);

  useEffect(() => {
    if (!project) return;
    api.get(`/api/projects/${project.id}/artifacts`).then(setArtifacts).catch(() => {});
  }, [project?.id]);

  if (!project) return (
    <div className="p-6 text-gray-500 text-sm">请先在仪表盘选择一个项目。</div>
  );

  const typeIcon = { jar: "📦", log: "📄", manifest: "📋", source: "🗜" };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-2">下载中心</h1>
      <p className="text-sm text-gray-400 mb-4">项目：{project.name}</p>
      {artifacts.length === 0 ? (
        <p className="text-gray-500 text-sm">暂无产物，请先构建项目。</p>
      ) : (
        <div className="space-y-2">
          {artifacts.map(a => (
            <div key={a.artifactId} className="bg-gray-800 rounded p-3 flex justify-between items-center">
              <div>
                <div className="text-sm font-medium">{typeIcon[a.type] ?? "📁"} {a.fileName}</div>
                <div className="text-xs text-gray-400">{(a.fileSize / 1024).toFixed(1)} KB · sha256: {a.sha256?.slice(0, 12)}…</div>
              </div>
              <a href={`/api/projects/${project.id}/artifacts/${a.artifactId}/download`}
                className="text-xs bg-green-700 hover:bg-green-600 px-3 py-1 rounded" download>
                下载
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedProject, setSelectedProject] = useState(null);

  const handleCreated = (p) => { setSelectedProject(p); setPage("dashboard"); };
  const handleSelectProject = (p) => { setSelectedProject(p); setPage("download"); };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar page={page} setPage={setPage} />
      <main className="flex-1 overflow-auto">
        {page === "dashboard" && <Dashboard onSelectProject={handleSelectProject} />}
        {page === "new-project" && <NewProject onCreated={handleCreated} />}
        {page === "download" && <DownloadCenter project={selectedProject} />}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
