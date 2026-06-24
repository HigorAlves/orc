---
name: docker-expert
description: "Docker expert — image optimization, security hardening, multi-stage builds, orchestration, production deployment. Use when writing or reviewing Dockerfiles, Compose, or container deploys."
category: devops
risk: unknown
source: community
date_added: "2026-02-27"
---

# Docker Expert

Advanced Docker containerization expertise: container optimization, security hardening, multi-stage builds, orchestration patterns, and production deployment based on current industry best practices.

## When to use

Use this skill when writing, optimizing, or reviewing Docker setups — Dockerfiles, `.dockerignore`, Docker Compose, multi-stage builds, image-size reduction, container security, resource limits, health checks, or production container deployment.

## When NOT to use (recommend switching and stop)

If the issue requires ultra-specific expertise outside Docker, recommend switching and stop:

- Kubernetes orchestration, pods, services, ingress → kubernetes-expert (future)
- GitHub Actions CI/CD with containers → github-actions-expert
- AWS ECS/Fargate or cloud-specific container services → devops-expert
- Database containerization with complex persistence → database-expert

Example to output:
"This requires Kubernetes orchestration expertise. Please invoke: 'Use the kubernetes-expert subagent.' Stopping here."

## Workflow

1. **Analyze** the container setup comprehensively (environment detection, project structure, running containers). See `references/production-deploy.md`. Prefer internal tools (Read, Grep, Glob) over shell; shell is a fallback.
2. **Identify** the specific problem category and complexity level (see the index below).
3. **Apply** the appropriate solution strategy from the relevant reference file.
4. **Validate** thoroughly (build, security scan, runtime, Compose config). See `references/production-deploy.md`.

Read the relevant `references/<topic>.md` file when you need that detail — each file holds the patterns, code review checklist items, and diagnostics for that topic. For a partial task, load only the references you need.

## Topic index

| Topic | When you need it | Reference |
|-------|------------------|-----------|
| Multi-stage builds & layer caching | Optimizing Dockerfiles, dependency caching, cross-platform/buildx, base image selection | `references/multistage-builds.md` |
| Image size optimization | Distroless, artifact selection, layer consolidation, shrinking large images | `references/image-optimization.md` |
| Security hardening | Non-root users, secrets management, build-time secrets, health checks, attack surface | `references/security-hardening.md` |
| Compose & dev workflow | Docker Compose orchestration, service deps, networks, volumes, hot-reload dev overrides | `references/compose.md` |
| Performance, resources & networking | Resource limits, restart policies, service discovery, networking issues, expert handoff | `references/orchestration.md` |
| Production deploy, validation & diagnostics | Environment detection, build/runtime/Compose validation, full diagnostics catalog | `references/production-deploy.md` |

## Core philosophy

Comprehensive Docker containerization with focus on practical optimization, security hardening, and production-ready patterns. Solutions emphasize performance, maintainability, and security best practices for modern container workflows.

## Limitations

- Use this skill only when the task clearly matches the scope described above.
- Do not treat the output as a substitute for environment-specific validation, testing, or expert review.
- Stop and ask for clarification if required inputs, permissions, safety boundaries, or success criteria are missing.
