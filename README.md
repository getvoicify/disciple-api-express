# Disciple API

Church and worship API for managing notes, scripture references, and church community.

## 🚀 Quick Start

### Using Docker (Recommended)

Pull the latest image from GitHub Container Registry:

```bash
docker pull ghcr.io/YOUR_USERNAME/disciple-api:latest
```

Run with Docker Compose:

```bash
docker compose up -d
```

### Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run development server with hot reload
npm run docker:dev
```

## 📦 Docker Images

This project automatically builds and publishes Docker images to GitHub Container Registry (ghcr.io) on every release.

### Available Tags

- `latest` - Latest stable release
- `X.Y.Z` - Specific version (e.g., `1.2.3`)
- `X.Y` - Latest patch of minor version (e.g., `1.2`)
- `X` - Latest minor of major version (e.g., `1`)

### Using the Docker Image

#### Docker Run

```bash
docker run -d \
  --name disciple-api \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e REDIS_URL=redis://default:pass@host:6379 \
  -e IAM_ENDPOINT=https://auth.example.com \
  -e IAM_REALM=my-realm \
  ghcr.io/getvoicify/disciple-api:latest
```

#### Docker Compose

```yaml
version: '3.9'

services:
  api:
    image: ghcr.io/getvoicify/disciple-api:latest
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/db
      REDIS_URL: redis://default:pass@redis:6379
      IAM_ENDPOINT: https://auth.example.com
      IAM_REALM: my-realm
    depends_on:
      - postgres
      - redis
```

### Authentication Required

To pull images from ghcr.io, you may need to authenticate:

```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `3000` |
| `NODE_ENV` | Environment (development/production) | No | `production` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `POSTGRES_DB` | Database name | Yes | - |
| `POSTGRES_USER` | Database user | Yes | - |
| `POSTGRES_PASSWORD` | Database password | Yes | - |
| `DB_HOST` | Database host | No | `localhost` |
| `DB_PORT` | Database port | No | `5432` |
| `REDIS_URL` | Redis connection string | Yes | - |
| `REDIS_PASSWORD` | Redis password | Yes | - |
| `IAM_ENDPOINT` | Authentication server URL | Yes | - |
| `IAM_REALM` | Authentication realm | Yes | - |

## 📚 API Documentation

Once running, the Swagger documentation is available at:

- **Local**: http://localhost:3000
- **Production**: https://your-domain.com

### Key Endpoints

#### Health & Documentation
- `GET /api/health` - Health check with database and Redis status
- `GET /api/openapi.json` - OpenAPI specification (JSON)
- `GET /api/openapi.yaml` - OpenAPI specification (YAML)

#### Notes
- `GET /api/notes` - List all notes
- `POST /api/notes` - Create a new note
- `GET /api/notes/:id` - Get a specific note
- `PUT /api/notes/:id` - Update a note
- `DELETE /api/notes/:id` - Delete a note

#### Posts
- `GET /api/posts` - List all posts
- `POST /api/posts` - Create a new post
- `GET /api/posts/:id` - Get a specific post
- `PATCH /api/posts/:id` - Update a post
- `DELETE /api/posts/:id` - Delete a post
- `PATCH /api/posts/:id/publish` - Publish a post
- `GET /api/posts/daily-devotionals` - Get daily devotionals (grouped by date)

#### Churches
- `GET /api/churches` - List churches
- `POST /api/churches` - Create a church
- `GET /api/churches/:id` - Get church details
- `PUT /api/churches/:id` - Update church
- `POST /api/churches/:id/members` - Join church
- `GET /api/churches/:id/members` - List church members

All API endpoints require JWT authentication via Bearer token.

### Health Check Endpoint

The `/api/health` endpoint provides comprehensive health monitoring:

```json
{
  "status": "healthy",        // "healthy", "degraded", or "unhealthy"
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.17.0",
  "database": "connected",    // "connected" or "disconnected"
  "redis": "connected",       // "connected", "disconnected", or "in-memory" (dev)
  "uptime": 3600.5,
  "environment": "production",
  "buildDate": "2024-01-15T08:00:00.000Z",
  "commitSha": "abc123"
}
```

**Status Logic:**
- `healthy` - Both database and Redis are operational
- `degraded` - One service is down but the API can still function
- `unhealthy` - Critical services are down (returns HTTP 503)

**Cache Modes:**
- Production/Staging: Uses Redis for distributed caching
- Development: Uses in-memory cache (shows as `"in-memory"`)

## 🏗️ Architecture

```
src/
├── cache/           # Cache abstraction layer
│   ├── cache.repository.ts          # Cache interface
│   ├── redis-cache.repository.ts   # Redis implementation
│   └── in-memory-cache.repository.ts # In-memory implementation
├── churches/        # Church management module
│   ├── service.ts                   # Business logic
│   ├── membership-service.ts       # Member management
│   └── postgres-repository.ts      # Database access
├── config/          # Configuration files
├── notes/           # Notes feature module
│   ├── routes/      # Express route handlers
│   ├── service.ts   # Business logic
│   └── repository.ts # Database access
├── posts/           # Posts/devotionals module
│   ├── routes/      # Express route handlers
│   │   └── dailyDevotionals.endpoint.ts # Daily devotionals
│   ├── service.ts   # Business logic
│   └── pg-repository.ts # Database access
├── series/          # Devotional series module
│   ├── service.ts   # Business logic
│   └── pg-repository.ts # Database access
├── schemas/         # Shared schemas
├── utils/           # Utility functions
└── index.ts         # Application entry point
```

### Key Features

#### Daily Devotionals
The `/api/posts/daily-devotionals` endpoint returns the latest published post from each series across all churches the user is a member of, grouped by the post's publication date. This allows users to access their daily devotional content in a single request.

**Response Format:**
```json
{
  "2024-01-15": [
    {
      "id": "post-id-1",
      "title": "Morning Devotional",
      "content": "...",
      "seriesId": "series-id-1",
      "seriesName": "Daily Bread",
      "publishedAt": "2024-01-15T08:00:00Z",
      ...
    },
    {
      "id": "post-id-2",
      "title": "Evening Reflection",
      "content": "...",
      "seriesId": "series-id-2",
      "seriesName": "Evening Prayer",
      "publishedAt": "2024-01-15T20:00:00Z",
      ...
    }
  ]
}
```

## 🔄 CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment:

1. **On Pull Request**: Runs tests and linting
2. **On Push to Main**:
   - Runs tests
   - Determines version using semantic-release
   - Creates GitHub release with changelog
   - Builds multi-architecture Docker image
   - Pushes to GitHub Container Registry
   - Scans for vulnerabilities

### Versioning

This project follows [Semantic Versioning](https://semver.org/) and uses [Conventional Commits](https://www.conventionalcommits.org/):

- `fix:` - Patch release (1.0.0 → 1.0.1)
- `feat:` - Minor release (1.0.1 → 1.1.0)
- `BREAKING CHANGE:` - Major release (1.1.0 → 2.0.0)

## 🛠️ Development

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 16+
- Redis 7+

### Scripts

```bash
npm run build       # Build TypeScript
npm run dev         # Run development server
npm run test        # Run tests
npm run lint        # Run linter
npm run docker:up   # Start Docker services
npm run docker:down # Stop Docker services
npm run docker:dev  # Run development with Docker
```

### Database Migrations

Migrations run automatically on container startup. SQL files in `/migrations` are executed in alphabetical order.

## 🔒 Security

- JWT authentication on all API endpoints
- Input validation with Zod schemas
- SQL injection protection via parameterized queries
- Rate limiting and security headers
- Regular vulnerability scanning in CI/CD

## 📝 Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for commit message conventions and development guidelines.

## 📄 License

This project is licensed under the MIT License.

## 🤝 Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/YOUR_USERNAME/disciple-api/issues) page.

---

**Current Version**: See [Releases](https://github.com/YOUR_USERNAME/disciple-api/releases)

**Docker Image**: `ghcr.io/YOUR_USERNAME/disciple-api`