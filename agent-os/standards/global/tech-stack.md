## Tech stack

This project uses a modern Node.js backend stack with TypeScript, Express, and PostgreSQL.

### Framework & Runtime
- **Application Framework:** Express 5.x
- **Language/Runtime:** Node.js with TypeScript 5.x
- **Package Manager:** npm
- **Development Runtime:** tsx (TypeScript execution)

### Backend Core Libraries
- **Validation:** Zod (schema validation and parsing)
- **Authentication:** JOSE (JWT token handling)
- **Logging:** Pino with pino-http middleware
- **Error Handling:** Custom safeExecute utility (tuple pattern)
- **File Uploads:** Multer

### Database & Storage
- **Database:** PostgreSQL
- **Query Library:** postgres (native PostgreSQL client)
- **Caching:** Redis (via ioredis)
- **Cloud Storage:** AWS S3 (via @aws-sdk/client-s3)
- **Image Processing:** Sharp

### Testing & Quality
- **Test Framework:** Vitest
- **Test UI:** @vitest/ui
- **Coverage:** @vitest/coverage-v8
- **HTTP Testing:** Supertest
- **Linting:** ESLint with TypeScript ESLint
- **Type Checking:** TypeScript strict mode

### API Documentation
- **OpenAPI Spec:** Swagger JSDoc
- **API UI:** Swagger UI Express
- **Documentation Format:** OpenAPI 3.0

### Development Tools
- **Hot Reload:** tsx watch mode
- **Containerization:** Docker & Docker Compose
- **Configuration:** dotenv (environment variables)
- **YAML Parsing:** js-yaml, yaml

### Third-Party Services
- **Authentication:** Keycloak (external identity provider)
- **Cloud Storage:** AWS S3 or compatible (Cloudflare R2)
- **Observability:** Structured logging via Pino

### Key Patterns & Utilities
- **Error Handling:** safeExecute utility for promise/error handling
- **Logging:** Structured logging with request-scoped correlation IDs
- **Validation:** Zod schemas for runtime type safety
- **Authentication:** JWT token validation with JOSE
- **Dependency Injection:** Factory pattern for endpoints
