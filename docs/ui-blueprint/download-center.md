# 下载中心

## 核心目标
跨项目展示所有产物，支持 jar / source zip / log / manifest 下载与删除。

## 线框

```
┌────────────────────────────────────────────────────────────────────────────┐
│  下载中心                                       存储占用：4.2 GB / 20 GB   │
├────────────────────────────────────────────────────────────────────────────┤
│  [搜索 🔍] [项目 ▾] [类型 ▾] [按时间 ▾]              [ 清理超期产物 ]    │
├────────────────────────────────────────────────────────────────────────────┤
│ 项目          │ 文件                  │ 类型   │ 大小  │ 构建于    │ ⋯  │
│ MyAwesomePl…  │ MyAwesomePlugin-1.0.0 │ jar    │ 89 KB │ 2 min ago │ ⋯  │
│               │   .jar                │        │       │           │     │
│ MyAwesomePl…  │ source-1.0.0.zip      │ source │ 12 MB │ 2 min ago │ ⋯  │
│ MyAwesomePl…  │ build.log             │ log    │ 145 KB│ 2 min ago │ ⋯  │
│ MyAwesomePl…  │ manifest.json         │ manif. │ 1 KB  │ 2 min ago │ ⋯  │
│ ProxyChat     │ ProxyChat-0.3.0.jar   │ jar    │ 67 KB │ 1 h ago   │ ⋯  │
└────────────────────────────────────────────────────────────────────────────┘
```

## 行操作 (⋯)

- 下载
- 复制 sha256
- 复制下载链接
- 删除（二次确认）

## 字段

| 字段 | 来源 |
|------|------|
| 文件名 | artifacts.file_name |
| 类型 | jar / zip / source / log / manifest |
| 大小 | artifacts.file_size 格式化为 KB/MB/GB |
| sha256 | artifacts.sha256（截断 8+8） |
| 构建于 | builds.started_at 相对时间 |
| Target / MC / Java | 来自 build 冗余字段 |

## 下载

```
GET /api/projects/:pid/artifacts/:aid/download
→ 302 不允许；必须流式
→ 设置 Content-Disposition: attachment; filename*=UTF-8''<encoded>
→ 设置 X-Artifact-Sha256
```

## 清理

- 自动：根据 `MC_FORGELAB_ARTIFACT_RETENTION_DAYS` + `MC_FORGELAB_MAX_ARTIFACT_STORAGE`
- 手动：[ 清理超期产物 ] 按钮 → 预览即将删除清单 → 二次确认

## 状态

- **空**：插画 + "尚无产物，先去构建一个项目吧"
- **存储超额警告**：顶部 banner 红色 + 引导清理
