# CLAUDE.md — Project Context for ContentForge

## 0. Project Identity

This is **ContentForge** — a personal AI content production system for one user (the owner).
Not SaaS, not multi-tenant, not commercial. Built for long-term self-use.

Working directory: `/Users/sam/Desktop/SAM/WEBSITE`

## 1. Mission

Build a system where:
1. Every asset is searchable 10 years from now
2. AI can produce videos end-to-end from a product/idea
3. The asset library is the soul; AI generation and video editing are clients of it

## 2. Tech Stack (LOCKED — do not suggest alternatives)

- **Backend**: Python 3.11 + FastAPI (monolith, never microservices)
- **Frontend**: Next.js 14 (App Router) + shadcn/ui + Tailwind
- **DB**: PostgreSQL 16 + pgvector + pg_trgm
- **Cache/Queue**: Redis 7 (cache + pub/sub only, NOT for tasks)
- **Tasks**: PostgreSQL `task` table + asyncio workers (custom, NOT Celery)
- **Storage**: Cloudflare R2 (S3-compatible) via boto3; local dev uses MinIO
- **Deployment**: Docker Compose (local), AWS US-East-1 (prod, future)
- **AI Gateway**: Custom unified adapter pattern; provider configs in `config/ai_models.yaml`

## 3. AI Models (Default Choices)

- Text/reasoning/vision: `claude-sonnet-4-7` (Anthropic)
- Image generation: `gpt-image-1` (OpenAI)
- Video generation default: Seedance 1.0 Pro via Replicate
- Video premium: Sora 2 (OpenAI), Veo 3 (Google)
- Avatar: HeyGen Avatar IV
- TTS: ElevenLabs v3
- ASR: Whisper-1 (OpenAI)
- Embedding text: text-embedding-3-large (dim 3072)
- Embedding visual: SigLIP-2 via Replicate (no self-hosted GPU)
- Bulk tagging (cost-sensitive): **Together AI Serverless** (Llama 3.3 70B / Qwen2.5 VL)
  — NOT self-hosted GPU server

## 4. Core Modules (priority order)

1. **asset** ★★★ TOP PRIORITY — entire system orbits this
2. **tag** — dictionary + relations
3. **collection** — flat groups + smart collections
4. **relation** — asset graph
5. **ai** — gateway + prompt management
6. **video** — Timeline renderer + FFmpeg
7. **pipeline** — one-click video generation
8. **analyzer** — viral video decomposition
9. **template** — video & script templates
10. **project / sku / brand** — business entities

## 5. Coding Conventions (STRICT)

- Python: PEP 8 + type hints everywhere + Pydantic v2 for I/O
- TypeScript: strict mode, no `any`
- Functions ≤ 50 lines, files ≤ 400 lines
- Service layer pattern: routers → services → repositories
- Routers NEVER write SQL directly
- All async I/O uses `async`/`await`, no blocking calls
- Logging: `loguru`, never `print`
- Errors: never `except: pass`; always log + propagate or handle explicitly
- Tests: pytest for backend, vitest for frontend; every service function has a test

## 6. Forbidden Patterns

- ❌ Microservices / service mesh
- ❌ Celery / RabbitMQ / RocketMQ
- ❌ Multi-tenant / users / RBAC / billing logic
- ❌ N+1 queries
- ❌ Storing files locally (always R2/MinIO)
- ❌ Hard-coding API keys (use .env / AWS Secrets Manager)
- ❌ Frontend doing business logic (pure presentation)
- ❌ Using `any` in TypeScript
- ❌ Self-hosted GPU server (use Together AI Serverless instead)

## 7. Development SOP

1. Atomic tasks: one PR = one feature, ≤ 500 LOC
2. Every weekend, `git pull && docker compose up` MUST work
3. Database changes: always Alembic migration, never manual SQL
4. New module checklist: models → schemas → service → tests → router → frontend page
5. Before marking task done: run lint + tests + manual smoke test

## 8. File Layout

```
content-forge/
├── CLAUDE.md
├── docker-compose.yml
├── pyproject.toml          # uv workspace root
├── pnpm-workspace.yaml
├── backend/                # Python FastAPI monolith
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── storage.py
│   │   │   ├── logger.py
│   │   │   └── ai_gateway/
│   │   ├── modules/        # business modules (asset, tag, etc.)
│   │   └── workers/        # asyncio task workers
│   ├── migrations/         # Alembic
│   └── tests/
├── frontend/               # Next.js 14
├── prompts/                # AI prompt templates (Markdown + frontmatter)
└── config/                 # ai_models.yaml, tags_seed.yaml
```

## 9. How To Run

Ports: **Backend = 8371**, **Frontend = 3847**

```bash
# Local dev (all services)
docker compose up

# Backend only (outside Docker)
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8371 --reload

# Frontend only
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:8371 pnpm dev --port 3847

# Run migrations
cd backend && alembic upgrade head

# Run worker
cd backend && python -m app.workers.main

# Tests
cd backend && uv run pytest
cd frontend && pnpm test
```

## 10. Environment Variables

All keys in `.env` (never commit). See `.env.example` for reference.
Production keys go into AWS Secrets Manager.

## 11. When Stuck

- Architecture questions → ask the owner first, do not invent solutions
- Bug fixes → reproduce with a test before fixing
- New dependencies → must justify and ask before adding

## 12. Quality Gates Before Each Commit

- [ ] All tests pass
- [ ] No new TypeScript / Python type errors
- [ ] No new lint warnings
- [ ] If touched DB: migration generated and tested
- [ ] If touched API: OpenAPI spec still valid
- [ ] No secrets in code
