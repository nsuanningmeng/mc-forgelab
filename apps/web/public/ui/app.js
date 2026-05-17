// Pre-built React app — no Babel required
const { useState, useEffect } = React;
const e = React.createElement;

const api = {
  get: (url) => fetch(url).then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(d))),
  post: (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
  del: (url) => fetch(url, { method: "DELETE" }),
};

function Sidebar({ page, setPage }) {
  const items = [["dashboard","仪表盘"],["new-project","新建项目"],["download","下载中心"]];
  return e("aside", { className: "w-48 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-2" },
    e("div", { className: "text-green-400 font-bold text-sm mb-4" }, "⚒ MC-AI-ForgeLab"),
    ...items.map(([id, label]) =>
      e("button", { key: id, onClick: () => setPage(id),
        className: `text-left px-3 py-2 rounded text-sm ${page === id ? "bg-green-700 text-white" : "text-gray-400 hover:bg-gray-800"}` }, label)
    )
  );
}

function Dashboard({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [health, setHealth] = useState(null);
  useEffect(() => {
    api.get("/api/projects").then(setProjects).catch(() => {});
    api.get("/api/health").then(setHealth).catch(() => {});
  }, []);
  return e("div", { className: "p-6" },
    e("h1", { className: "text-xl font-bold mb-4" }, "仪表盘"),
    e("div", { className: "grid grid-cols-3 gap-4 mb-6" },
      e("div", { className: "bg-gray-800 rounded p-4" },
        e("div", { className: "text-2xl font-bold text-green-400" }, projects.length),
        e("div", { className: "text-sm text-gray-400" }, "项目总数")),
      e("div", { className: "bg-gray-800 rounded p-4" },
        e("div", { className: `text-2xl font-bold ${health?.ok ? "text-green-400" : "text-red-400"}` }, health?.ok ? "运行中" : "离线"),
        e("div", { className: "text-sm text-gray-400" }, "服务状态")),
      e("div", { className: "bg-gray-800 rounded p-4" },
        e("div", { className: "text-2xl font-bold text-blue-400" }, health?.version ?? "-"),
        e("div", { className: "text-sm text-gray-400" }, "版本"))
    ),
    e("h2", { className: "text-lg font-semibold mb-3" }, "最近项目"),
    projects.length === 0
      ? e("p", { className: "text-gray-500 text-sm" }, "暂无项目，点击"新建项目"开始。")
      : e("div", { className: "space-y-2" },
          ...projects.slice(0, 10).map(p =>
            e("div", { key: p.id, onClick: () => onSelectProject(p),
              className: "bg-gray-800 rounded p-3 flex justify-between items-center cursor-pointer hover:bg-gray-700" },
              e("div", null,
                e("div", { className: "font-medium text-sm" }, p.name),
                e("div", { className: "text-xs text-gray-400" }, `${p.target_id} · ${p.minecraft_version}`)),
              e("div", { className: "text-xs text-gray-500" }, (p.created_at ?? "").slice(0, 10))
            )
          )
        )
  );
}

function NewProject({ onCreated }) {
  const [form, setForm] = useState({ name: "", targetId: "paper", minecraftVersion: "1.20.1", packageName: "com.example.plugin" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (ev) => setForm(f => ({ ...f, [k]: ev.target.value }));
  const submit = async (ev) => {
    ev.preventDefault(); setLoading(true); setError(null);
    try { const p = await api.post("/api/projects", form); if (p.error) { setError(p.error); return; } onCreated(p); }
    catch (err) { setError(err?.error ?? String(err)); }
    finally { setLoading(false); }
  };
  const field = (label, key, placeholder) =>
    e("div", null,
      e("label", { className: "block text-sm text-gray-400 mb-1" }, label),
      e("input", { value: form[key], onChange: set(key), placeholder,
        className: "w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500" })
    );
  return e("div", { className: "p-6 max-w-lg" },
    e("h1", { className: "text-xl font-bold mb-4" }, "新建项目"),
    e("form", { onSubmit: submit, className: "space-y-4" },
      field("项目名称", "name", "MyPlugin"),
      e("div", null,
        e("label", { className: "block text-sm text-gray-400 mb-1" }, "目标端"),
        e("select", { value: form.targetId, onChange: set("targetId"),
          className: "w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" },
          ...["paper","spigot","purpur","folia","velocity","fabric","forge"].map(t => e("option", { key: t, value: t }, t))
        )
      ),
      field("Minecraft 版本", "minecraftVersion", "1.20.1"),
      field("包名", "packageName", "com.example.plugin"),
      error && e("div", { className: "text-red-400 text-sm" }, error),
      e("button", { type: "submit", disabled: loading,
        className: "w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded py-2 text-sm font-medium" },
        loading ? "创建中..." : "创建项目")
    )
  );
}

function DownloadCenter({ project }) {
  const [artifacts, setArtifacts] = useState([]);
  useEffect(() => {
    if (!project) return;
    api.get(`/api/projects/${project.id}/artifacts`).then(setArtifacts).catch(() => {});
  }, [project?.id]);
  if (!project) return e("div", { className: "p-6 text-gray-500 text-sm" }, "请先在仪表盘选择一个项目。");
  const icons = { jar: "📦", log: "📄", manifest: "📋", source: "🗜" };
  return e("div", { className: "p-6" },
    e("h1", { className: "text-xl font-bold mb-2" }, "下载中心"),
    e("p", { className: "text-sm text-gray-400 mb-4" }, `项目：${project.name}`),
    artifacts.length === 0
      ? e("p", { className: "text-gray-500 text-sm" }, "暂无产物，请先构建项目。")
      : e("div", { className: "space-y-2" },
          ...artifacts.map(a =>
            e("div", { key: a.artifactId, className: "bg-gray-800 rounded p-3 flex justify-between items-center" },
              e("div", null,
                e("div", { className: "text-sm font-medium" }, `${icons[a.type] ?? "📁"} ${a.fileName}`),
                e("div", { className: "text-xs text-gray-400" }, `${((a.fileSize ?? 0) / 1024).toFixed(1)} KB · sha256: ${(a.sha256 ?? "").slice(0, 12)}…`)),
              e("a", { href: `/api/projects/${project.id}/artifacts/${a.artifactId}/download`,
                className: "text-xs bg-green-700 hover:bg-green-600 px-3 py-1 rounded", download: true }, "下载")
            )
          )
        )
  );
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedProject, setSelectedProject] = useState(null);
  const handleCreated = (p) => { setSelectedProject(p); setPage("dashboard"); };
  const handleSelect = (p) => { setSelectedProject(p); setPage("download"); };
  return e("div", { className: "flex h-screen overflow-hidden" },
    e(Sidebar, { page, setPage }),
    e("main", { className: "flex-1 overflow-auto" },
      page === "dashboard" && e(Dashboard, { onSelectProject: handleSelect }),
      page === "new-project" && e(NewProject, { onCreated: handleCreated }),
      page === "download" && e(DownloadCenter, { project: selectedProject })
    )
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(e(App));
