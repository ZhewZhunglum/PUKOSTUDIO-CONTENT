# ContentForge — 上云部署指南

## 架构概览

```
Internet
    │ :80
    ▼
  nginx (Docker)
  ├── /api/*  ──► backend:8371 (FastAPI)
  ├── /docs   ──► backend:8371
  └── /*      ──► frontend:3847 (Next.js)

backend ──► Neon PostgreSQL (外部)
backend ──► Cloudflare R2 (外部)
backend ──► redis:6379 (Docker, 本机)
```

---

## 前置准备（在你的本地机器上完成）

### 1. Neon 数据库

1. 注册 [neon.tech](https://neon.tech) → 新建项目 → 选 **US East** 区域
2. 进入项目 → **Connection Details** → 复制连接字符串
3. 连接字符串格式（改为 asyncpg driver）：
   ```
   postgresql+asyncpg://USER:PASS@ep-XXX.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. 在 Neon 的 SQL Editor 里执行一次启用 pgvector：
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```

### 2. Cloudflare R2

1. 登录 Cloudflare → **R2 Object Storage** → 新建 bucket，命名 `contentforge-assets`
2. **Manage R2 API Tokens** → 新建 token（权限：Object Read & Write，限定该 bucket）
3. 记下：Account ID、Access Key ID、Secret Access Key
4. 开启 bucket 的 **Public Access**（或设置自定义域名）→ 得到 Public URL

### 3. Hetzner 服务器

1. 登录 [hetzner.com](https://www.hetzner.com/cloud) → 新建服务器
   - 类型：**CX32**（4 vCPU, 8 GB RAM）
   - 镜像：**Ubuntu 24.04**
   - 区域：**Ashburn, VA（美国）**
   - SSH Key：添加你的公钥
2. 记下服务器 IP（假设为 `1.2.3.4`）

---

## 部署步骤

### Step 1：服务器初始化（只做一次）

```bash
# SSH 进入服务器（root）
ssh root@1.2.3.4

# 下载并运行初始化脚本
curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/deploy/setup.sh | bash
# 或者先传文件再运行：
# scp deploy/setup.sh root@1.2.3.4:/tmp/
# ssh root@1.2.3.4 "bash /tmp/setup.sh"
```

初始化脚本会：
- 更新系统、安装 Docker
- 创建 `cf` 用户（有 docker 权限）
- 配置 ufw 防火墙（开放 22、80、443）
- 启用 fail2ban

### Step 2：上传代码

```bash
# 方式 A：git（推荐）
ssh cf@1.2.3.4
git clone https://github.com/YOUR_REPO /opt/contentforge
cd /opt/contentforge

# 方式 B：rsync（直接推本地代码）
rsync -avz --exclude='.git' --exclude='node_modules' --exclude='.venv' \
  --exclude='.next' --exclude='*.env' \
  /Users/sam/Desktop/SAM/WEBSITE/ \
  cf@1.2.3.4:/opt/contentforge/
```

### Step 3：配置生产环境变量

```bash
ssh cf@1.2.3.4
cd /opt/contentforge
cp .env.prod.example .env.prod
nano .env.prod   # 填入所有值
```

**必填项清单：**

| 变量 | 从哪里获取 |
|------|-----------|
| `DATABASE_URL` | Neon → Connection Details |
| `S3_ENDPOINT` | `https://ACCOUNT_ID.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY` | Cloudflare R2 → API Token |
| `S3_SECRET_KEY` | Cloudflare R2 → API Token |
| `S3_PUBLIC_DOMAIN` | R2 bucket 的 Public URL（格式 `https://pub-XXX.r2.dev`）|
| `NEXT_PUBLIC_API_URL` | `http://1.2.3.4`（你的 Hetzner IP）|
| `NEXT_PUBLIC_STORAGE_DOMAIN` | R2 域名（不含 https://，如 `pub-XXX.r2.dev`）|
| `ALLOWED_ORIGINS` | 同 `NEXT_PUBLIC_API_URL` |
| `SECRET_KEY` | 运行 `openssl rand -hex 32` 生成 |
| `ANTHROPIC_API_KEY` | Anthropic Console |

### Step 4：首次部署

```bash
ssh cf@1.2.3.4
cd /opt/contentforge
bash deploy/deploy.sh
```

脚本会自动：
1. 构建 Docker 镜像（含前端生产构建）
2. 运行 Alembic 数据库迁移
3. 启动所有服务
4. 轮询健康检查（`/healthz`）

完成后访问 `http://1.2.3.4` 即可看到系统界面。

---

## 后续更新

```bash
ssh cf@1.2.3.4
cd /opt/contentforge
bash deploy/deploy.sh          # pull + rebuild + migrate + restart

# 不 pull 只 rebuild（本地改了代码后 rsync 过来）
bash deploy/deploy.sh --no-pull
```

---

## 常用运维命令

```bash
# 查看所有服务状态
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# 看实时日志
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f

# 只看 backend 日志
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend

# 重启单个服务
docker compose -f docker-compose.prod.yml --env-file .env.prod restart worker

# 手动跑迁移
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm backend alembic upgrade head

# 查看磁盘使用
docker system df
df -h

# 清理不用的镜像
docker image prune -f
```

---

## 目录结构说明

```
deploy/
├── README.md        ← 本文件
├── nginx.conf       ← nginx 反向代理配置（挂载到容器）
├── setup.sh         ← 服务器一次性初始化脚本
└── deploy.sh        ← 部署/更新脚本

docker-compose.prod.yml   ← 生产 Compose 文件
.env.prod.example         ← 生产环境变量模板
```

---

## 故障排查

### 健康检查失败
```bash
# 直接查后端日志
docker compose -f docker-compose.prod.yml --env-file .env.prod logs backend --tail=100

# 测试数据库连接
docker compose -f docker-compose.prod.yml --env-file .env.prod \
  run --rm backend python -c "
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def check():
    engine = create_async_engine(settings.database_url)
    async with engine.connect() as c:
        r = await c.execute(text('SELECT version()'))
        print(r.scalar())
asyncio.run(check())
"
```

### 前端白屏 / API 请求 404
- 检查 `NEXT_PUBLIC_API_URL` 是否正确填写（`http://1.2.3.4`，无端口，无尾 slash）
- 前端是否是最新构建：`docker compose -f docker-compose.prod.yml ... build frontend`

### R2 上传失败
- 检查 S3_ENDPOINT 格式：`https://ACCOUNT_ID.r2.cloudflarestorage.com`（无 bucket 名）
- 检查 R2 Token 权限是否包含该 bucket 的读写
