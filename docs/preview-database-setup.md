# Preview Environment Database Setup with CloudNativePG

This document explains how the temporary CloudNativePG databases are set up for each PR preview environment.

## Architecture Overview

Each PR preview environment gets its own isolated PostgreSQL database managed by CloudNativePG:

- **Database Cluster**: `disciple-api-preview-{PR_NUMBER}-db`
- **Database Name**: `disciple_api_preview_{PR_NUMBER}`
- **Service**: `disciple-api-preview-{PR_NUMBER}-db-rw` (read-write)
- **Credentials**: `disciple-api-preview-{PR_NUMBER}-db-credentials`

## How It Works

### 1. Base Resources (`k8s/base/`)

- **`cnpg-cluster.yaml`**: CloudNativePG Cluster template
- **`cnpg-secret.yaml`**: Database credentials template
- **`db-migration-job.yaml`**: Database initialization job

### 2. ApplicationSet Patches

When a PR is labeled with "preview", the ApplicationSet applies patches to:

```yaml
# Database cluster gets PR-specific name
disciple-api-preview-{PR_NUMBER}-db

# Database credentials
disciple-api-preview-{PR_NUMBER}-db-credentials

# API deployment connects to new database
DB_HOST: disciple-api-preview-{PR_NUMBER}-db-rw
POSTGRES_DB: disciple_api_preview_{PR_NUMBER}
```

### 3. Environment Variables

The API container receives these environment variables:

```bash
DB_HOST=disciple-api-preview-7-db-rw
DB_PORT=5432
POSTGRES_DB=disciple_api_preview_7
POSTGRES_USER=disciple_user
POSTGRES_PASSWORD=<from-cnpg-secret>
PR_NUMBER=7
PR_BRANCH=feature/new-feature
```

## Database Lifecycle

### Creation
1. PR labeled with "preview"
2. ApplicationSet creates CloudNativePG cluster
3. Database initializes with schema
4. Migration job runs (optional)
5. API deployment connects to new database

### Cleanup
1. PR closed/merged
2. ApplicationSet deletes all resources
3. CloudNativePG cluster and PVCs are removed
4. No manual cleanup required

## Benefits

- **Isolation**: Each preview has its own database
- **Automatic**: No manual database management
- **Clean**: Automatic cleanup when PR closes
- **Fast**: Local cluster database (no external dependencies)
- **Secure**: Credentials managed by CloudNativePG

## Database Connection

The API connects using standard PostgreSQL connection:

```typescript
// src/utils/database.ts
const db = postgres({
  host: process.env.DB_HOST,           // disciple-api-preview-7-db-rw
  port: parseInt(process.env.DB_PORT), // 5432
  database: process.env.POSTGRES_DB,   // disciple_api_preview_7
  username: process.env.POSTGRES_USER, // disciple_user
  password: process.env.POSTGRES_PASSWORD // from CloudNativePG secret
});
```

## Monitoring

CloudNativePG provides built-in monitoring:
- PodMonitor: `disciple-api-preview-{PR_NUMBER}-db`
- Metrics endpoint for Prometheus
- Connection pooling statistics

## Example: PR #7

For PR #7, these resources are created:

```bash
# Namespace
disciple-api-preview-7

# Database Cluster
disciple-api-preview-7-db

# Services
disciple-api-preview-7-db-rw    # Read-write
disciple-api-preview-7-db-ro    # Read-only
disciple-api-preview-7-db-r     # Read-only (replica)

# Secrets
disciple-api-preview-7-db-credentials

# API URL
https://pr-7.preview.infra.api.pottersville.church
```

All resources are automatically cleaned up when PR #7 is closed.