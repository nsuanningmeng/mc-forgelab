# 数据模型

## SQLite 表（阶段 1 已创建迁移）

迁移 ID `0001_init` 在 `runMigrations()` 时建表，所有表使用 SQLite 推荐的 `snake_case` 列名。

### `_mcforgelab_migrations`

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | 迁移 ID，如 `0001_init` |
| applied_at | TEXT NOT NULL | ISO8601 |

### `settings`

阶段 1 即用，存全局 key-value 配置。

| 列 | 类型 | 说明 |
|----|------|------|
| key | TEXT PK | 配置键 |
| value | TEXT NOT NULL | 字符串值（JSON 由调用方序列化） |
| updated_at | TEXT NOT NULL | ISO8601 |

### `projects`

阶段 3 写入；阶段 1 仅建表。

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | UUID v4 |
| name | TEXT | 显示名 |
| slug | TEXT UNIQUE | URL 友好（`isSafeFileName`）|
| type | TEXT | plugin / mod / proxy / hybrid |
| target_id | TEXT | 指向 target-registry id |
| minecraft_version | TEXT | `1.20.4` 等 |
| java_version | INTEGER | 8/11/17/21 |
| build_tool | TEXT | gradle / maven |
| package_name | TEXT | Java 包名 |
| main_class | TEXT NULL | 主类 |
| project_path | TEXT | workspace 内相对路径 |
| created_at | TEXT | ISO8601 |
| updated_at | TEXT | ISO8601 |

索引：`idx_projects_target(target_id)`。

### `builds`

阶段 5 写入；阶段 1 仅建表。

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | UUID v4 |
| project_id | TEXT FK → projects.id | ON DELETE CASCADE |
| status | TEXT | queued / running / success / failed / canceled / interrupted |
| started_at | TEXT | ISO8601 |
| finished_at | TEXT NULL | ISO8601 |
| target_id | TEXT | 冗余记录构建时 target |
| minecraft_version | TEXT | 冗余 |
| java_version | INTEGER | 冗余 |
| build_tool | TEXT | gradle / maven |
| log_path | TEXT NULL | workspace 内日志文件相对路径 |
| error_summary | TEXT NULL | 友好错误摘要 |
| compatibility_warnings | TEXT NULL | JSON 数组 |

索引：`idx_builds_project(project_id)`、`idx_builds_status(status)`。

### `artifacts`

阶段 6 写入；阶段 1 仅建表。

| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | UUID v4 |
| project_id | TEXT FK → projects.id | ON DELETE CASCADE |
| build_id | TEXT FK → builds.id | ON DELETE CASCADE |
| file_name | TEXT | 用户可见文件名 |
| file_path | TEXT | workspace/artifacts 内相对路径 |
| file_size | INTEGER | 字节 |
| sha256 | TEXT | 小写 hex |
| type | TEXT | jar / zip / source / log / manifest |
| created_at | TEXT | ISO8601 |
| downloadable | INTEGER | 0 / 1 |

索引：`idx_artifacts_project(project_id)`、`idx_artifacts_build(build_id)`。

## TypeScript 接口

### ProjectSpec（packages/project-model 阶段 2 实施）

```ts
export interface ProjectSpec {
  readonly id?: string;
  readonly name: string;
  readonly slug: string;
  readonly type: "plugin" | "mod" | "proxy" | "hybrid";
  readonly targetId: string;
  readonly minecraftVersion: string;
  readonly javaVersion: number;
  readonly buildTool: "gradle" | "maven";
  readonly packageName: string;
  readonly mainClass?: string;
  readonly author?: string;
  readonly description?: string;
  readonly version: string;
  readonly features?: ProjectFeatures;
  readonly modules?: ReadonlyArray<ProjectModuleSpec>;
}
```

详见 `schemas/project.schema.json`。

### ArtifactManifest（packages/artifact-manager 阶段 6 实施）

每次构建落盘 `dist/manifest.json`：

```ts
export interface ArtifactManifest {
  readonly schemaVersion: 1;
  readonly projectId: string;
  readonly projectName: string;
  readonly targetId: string;
  readonly minecraftVersion: string;
  readonly javaVersion: number;
  readonly buildId: string;
  readonly builtAt: string;
  readonly outputs: Array<{
    readonly fileName: string;
    readonly type: "jar" | "zip" | "source" | "log" | "manifest";
    readonly sha256: string;
    readonly sizeBytes: number;
  }>;
  readonly compatibilityWarnings: Array<{
    readonly code: string;
    readonly level: "info" | "warning" | "error";
    readonly messageZh: string;
    readonly messageEn: string;
  }>;
}
```

## 数据生命周期

| 表 | 写入阶段 | 清理策略 |
|----|---------|----------|
| settings | 任何阶段 | 用户手动删除 |
| projects | 3+ | DELETE /api/projects/:id 级联删除 builds/artifacts |
| builds | 5+ | 保留全部历史；artifact retention 单独控制 |
| artifacts | 6+ | `MC_FORGELAB_ARTIFACT_RETENTION_DAYS`（默认 30 天）+ `MC_FORGELAB_MAX_ARTIFACT_STORAGE`（默认 20 GB）双约束 |

## 未来扩展

阶段 10 引入外部数据库适配器层（MySQL/PostgreSQL），通过 `StorageBackend` 抽象。当前 SQLite 是默认且唯一实现。
