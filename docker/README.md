# Docker 部署（阶段 7 实施）

## 当前状态

阶段 1 已提供：

- `Dockerfile.skeleton` — 多阶段构建骨架，包含非 root 用户、tini PID 1、工具链与数据目录布局
- `docker-compose.skeleton.yml` — 端口/卷/环境变量模板
- `docs/nginx-example.conf` — 反向代理参考

阶段 7 将正式补全：

- 预装 JDK 17 / 21、Maven、常用 Gradle distribution cache
- Web 服务入口（`apps/web/dist/server.js`）
- 健康检查指向 `/api/health`
- 镜像推送至 ghcr.io / Docker Hub

## 当前可验证

```bash
docker build -f docker/Dockerfile.skeleton -t mc-forgelab:stage1 .
docker run --rm mc-forgelab:stage1     # 执行 mcforgelab doctor
```

## 设计纪律

- **基础镜像选 Debian slim**，**不**用 Alpine（avoid better-sqlite3 + musl 编译陷阱）
- **非 root**：UID/GID 1000；workspace/cache/logs/db/artifacts 挂载点 chown 到 mcfl
- **tini 作为 PID 1**：避免构建子进程僵尸/孤儿
- **不要求**用户进入容器安装工具
- **不映射** `/var/run/docker.sock`，不需要 `--privileged`
- 内置工具链通过命名 volume `mcfl-toolchains` 持久化（避免重建丢失）

## 反向代理

见 [docs/nginx-example.conf](../docs/nginx-example.conf)：

- SSE 必需 `proxy_buffering off; X-Accel-Buffering no;`
- 大文件下载 `proxy_max_temp_file_size 0`
- 长超时 `proxy_read_timeout 1d`
