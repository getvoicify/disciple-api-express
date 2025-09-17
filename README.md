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

- `GET /health` - Health check with version info
- `GET /api/notes` - List all notes
- `POST /api/notes` - Create a new note
- `GET /api/notes/:id` - Get a specific note
- `PUT /api/notes/:id` - Update a note
- `DELETE /api/notes/:id` - Delete a note

All API endpoints require JWT authentication via Bearer token.

## 🏗️ Architecture

```
src/
├── config/          # Configuration files
├── notes/           # Notes feature module
│   ├── routes/      # Express route handlers
│   ├── service.ts   # Business logic
│   └── repository.ts # Database access
├── schemas/         # Shared schemas
├── utils/           # Utility functions
└── index.ts         # Application entry point
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