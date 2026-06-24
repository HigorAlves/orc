# Production Deployment, Validation & Diagnostics

## Comprehensive Setup Analysis

**Use internal tools first (Read, Grep, Glob) for better performance. Shell commands are fallbacks.**

```bash
# Docker environment detection
docker --version 2>/dev/null || echo "No Docker installed"
docker info | grep -E "Server Version|Storage Driver|Container Runtime" 2>/dev/null
docker context ls 2>/dev/null | head -3

# Project structure analysis
find . -name "Dockerfile*" -type f | head -10
find . -name "*compose*.yml" -o -name "*compose*.yaml" -type f | head -5
find . -name ".dockerignore" -type f | head -3

# Container status if running
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" 2>/dev/null | head -10
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null | head -10
```

**After detection, adapt approach:**
- Match existing Dockerfile patterns and base images
- Respect multi-stage build conventions
- Consider development vs production environments
- Account for existing orchestration setup (Compose/Swarm)

## Validation

```bash
# Build and security validation
docker build --no-cache -t test-build . 2>/dev/null && echo "Build successful"
docker history test-build --no-trunc 2>/dev/null | head -5
docker scout quickview test-build 2>/dev/null || echo "No Docker Scout"

# Runtime validation
docker run --rm -d --name validation-test test-build 2>/dev/null
docker exec validation-test ps aux 2>/dev/null | head -3
docker stop validation-test 2>/dev/null

# Compose validation
docker-compose config 2>/dev/null && echo "Compose config valid"
```

## Diagnostics Overview

### Build Performance Issues
**Symptoms**: Slow builds (10+ minutes), frequent cache invalidation
**Root causes**: Poor layer ordering, large build context, no caching strategy
**Solutions**: Multi-stage builds, .dockerignore optimization, dependency caching

### Security Vulnerabilities
**Symptoms**: Security scan failures, exposed secrets, root execution
**Root causes**: Outdated base images, hardcoded secrets, default user
**Solutions**: Regular base updates, secrets management, non-root configuration

### Image Size Problems
**Symptoms**: Images over 1GB, deployment slowness
**Root causes**: Unnecessary files, build tools in production, poor base selection
**Solutions**: Distroless images, multi-stage optimization, artifact selection

### Networking Issues
**Symptoms**: Service communication failures, DNS resolution errors
**Root causes**: Missing networks, port conflicts, service naming
**Solutions**: Custom networks, health checks, proper service discovery

### Development Workflow Problems
**Symptoms**: Hot reload failures, debugging difficulties, slow iteration
**Root causes**: Volume mounting issues, port configuration, environment mismatch
**Solutions**: Development-specific targets, proper volume strategy, debug configuration
