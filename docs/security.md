# 安全模型与合规边界

## 1. 路径安全

所有 user-supplied 路径必经 `@mc-forgelab/core` 的 `resolveInsideBase(base, input)`：

- 拒绝 `..` 段
- 拒绝 base 之外的绝对路径
- 拒绝控制字符与 Windows 保留名
- 拒绝结尾 `.` / 空格

允许下载/读取的根目录白名单（阶段 6 起强制）：

```
${workspace}/projects/...   项目源码
${workspace}/artifacts/...   产物（jar/zip/source）
${logs}/...                  构建日志
${cache}/...                 工具链 / 下载缓存
${db}                        SQLite 文件（不直接对外暴露）
```

**不允许**通过 API 读取 `${db}` 文件本体或 `${toolchains}/manifest.json` 中的绝对路径回显给用户。

## 2. 命令执行

构建编排恒定使用：

```ts
spawn(executable, args, { shell: false, cwd, env });
```

- `executable` 必须是绝对路径，由 toolchain-manager 解析
- `args` 必须是 `string[]`，**永不**字符串拼接
- `env` 显式构造，**不继承** `process.env.PATH` 中的 java/gradle/mvn
- 必须设置：`JAVA_HOME`、`GRADLE_USER_HOME`、`MAVEN_USER_HOME`（如适用）
- 不允许 `exec(cmd: string)` / `execSync` 接受用户输入

## 3. 模板渲染

- 模板变量在写入前 escape（Java/JSON/YAML 三种语境分别 sanitize）
- 模板输出路径用 `resolveInsideBase(outputDir, relPath)` 校验
- 模板版本号 + 兼容 target 列表强校验
- 渲染前的覆盖保护：若目标文件已存在，需 `--overwrite` 显式确认

## 4. 认证与鉴权（阶段 6 起）

- 默认 `MC_FORGELAB_AUTH_ENABLED=false`（本地友好）
- 检测到任一条件 → 启动时强提示：
  - `MC_FORGELAB_BASE_URL` 是 https
  - `MC_FORGELAB_HOST=0.0.0.0`
  - 非 localhost / 127.0.0.1 / Docker 内网
- 密码：argon2id 哈希存储；明文密码**绝不**写日志
- 下载接口必经鉴权（auth 启用时）
- 限速：`MCF_API_RATE_LIMITED` 错误码预留

## 5. 错误信息脱敏

- AppError `details` 字段禁止包含：密码、Token、API Key、Cookie、Authorization 头
- `toHttpError({ includeStack: false })` 默认隐藏 stack
- 原始命令 stderr 不直接返回给前端，需经 `errorSummary` 转译

## 6. Docker 安全

- 默认非 root（UID/GID 1000 或自定义）
- workspace / cache / logs / db 显式 volume 挂载
- 不需要 `--privileged`、不映射 `/var/run/docker.sock`
- 基础镜像选 Debian slim（避免 Alpine musl + better-sqlite3 编译问题）

## 7. 合规边界（产品红线）

**不**：

- 内置盗版 Minecraft 服务端 jar（如 BuildTools 输出物可由用户自备）
- 绕过 Mojang 正版验证 / 修改 yggdrasil 验证流程
- 提供"破解"、"绕授权"模板或脚本
- 内置后门、盗号、远控、DDoS、爬取玩家信息等恶意能力
- 自动下载/缓存 Mojang 闭源资产

**允许**：

- 用户自行提供的合规 Minecraft 服务端 / 第三方 jar 路径
- 开源运行时（Paper / Folia / Velocity / Fabric Loader / Forge / NeoForge / Quilt）

## 8. 依赖与供应链

- `package.json` 锁版本，pnpm lockfile 提交
- native module（better-sqlite3）使用预构建版本；CI 校验 sha256
- 阶段 10 引入 SCA：`pnpm audit` + 第三方 SBOM 生成
