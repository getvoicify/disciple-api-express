# Tech Stack

## Backend Framework

### Express 5 with TypeScript 5
- **Purpose:** Core REST API framework providing routing, middleware, and HTTP server functionality
- **Rationale:** Express is the industry-standard Node.js framework with mature ecosystem, extensive middleware support, and proven reliability at scale. Version 5 provides modern async/await support and improved performance. TypeScript adds type safety, better IDE support, and compile-time error detection.
- **Key Features Used:**
  - Middleware pipeline for request processing
  - Router-based endpoint organization
  - Async request handler support
  - Error handling middleware

## Database & Data Layer

### PostgreSQL
- **Purpose:** Primary relational database for all application data (churches, users, devotionals, notes, prayers, media metadata)
- **Rationale:** PostgreSQL provides robust ACID compliance, complex relationship handling (churches, members, content hierarchies), advanced querying capabilities (full-text search, JSON support), and excellent scalability for multi-tenant architecture. Proven reliability for enterprise applications.
- **Key Features Used:**
  - Relational data modeling (foreign keys, joins)
  - Database migrations for schema versioning
  - Transactional integrity for critical operations
  - Indexing for query performance

### Repository Pattern
- **Purpose:** Data access abstraction layer separating business logic from database queries
- **Rationale:** Repositories provide testability, maintainability, and flexibility to change data access implementations without affecting business logic. Enables clean dependency injection and mocking in tests.
- **Implementation:** Dedicated repository classes per domain entity (MediaRepository, DevotionalRepository, etc.)

## Authentication & Authorization

### Keycloak
- **Purpose:** Enterprise identity and access management (IAM) for user authentication, SSO, and role-based access control
- **Rationale:** Keycloak provides production-ready OAuth2/OIDC implementation, user federation, role management, and admin console out-of-the-box. Eliminates need to build custom auth infrastructure. Supports multi-church tenant isolation and complex permission models.
- **Key Features Used:**
  - OAuth2/OIDC authentication flows
  - JWT token generation and validation
  - Role-based access control (church admin, pastor, member)
  - User management and federation

### JOSE (JavaScript Object Signing and Encryption)
- **Purpose:** JWT token validation and claims extraction
- **Rationale:** Industry-standard library for secure JWT handling with strong cryptographic support
- **Implementation:** JWT payload extraction at `req.user[1].payload`, user ID from `sub` claim

## Validation & Type Safety

### Zod
- **Purpose:** Runtime schema validation for request payloads, environment variables, and external data
- **Rationale:** Zod provides TypeScript-first validation with automatic type inference, reducing duplication between validation rules and TypeScript types. Produces actionable validation error messages for API consumers.
- **Use Cases:**
  - Request body validation
  - Query parameter validation
  - Environment configuration validation
  - Data transformation and sanitization

## Logging & Observability

### Pino
- **Purpose:** High-performance structured JSON logging with request correlation and context propagation
- **Rationale:** Pino is the fastest Node.js logger, essential for production performance. Structured logging enables powerful log aggregation, searching, and monitoring in production environments. Automatic sensitive data redaction (passwords, tokens).
- **Key Features Used:**
  - Request-scoped logging via `req.log` with correlation IDs
  - Application-wide logging via singleton `logger`
  - Log levels (trace, debug, info, warn, error, fatal)
  - Context-first logging pattern: `logger.error({ error, userId }, 'message')`

### Logger Abstraction Layer
- **Purpose:** Interface-based logging (`ILogger`, `ILoggerFactory`) enabling swap of Pino for other implementations
- **Rationale:** Future-proofs logging infrastructure, simplifies testing with mock loggers, supports different logging backends per environment

## Caching

### Redis (ioredis)
- **Purpose:** High-performance in-memory caching for devotional content, user sessions, and frequently accessed data
- **Rationale:** Redis reduces database load, improves API response times, and enables session management across multiple API instances. ioredis provides robust Redis client with cluster support, connection pooling, and automatic reconnection.
- **Use Cases:**
  - Devotional content caching
  - Session storage
  - Rate limiting
  - Cache invalidation on content updates

## Storage & Media

### AWS S3 / Cloudflare R2
- **Purpose:** Cloud object storage for media files (images, videos, attachments) associated with devotional content
- **Rationale:** S3-compatible object storage provides reliable, scalable, cost-effective storage with CDN integration for fast global delivery. R2 offers S3 compatibility with zero egress fees. Separates media storage from application database for optimal performance.
- **Key Features Used:**
  - Multipart upload for large files
  - Presigned URLs for secure direct uploads
  - Lifecycle policies for cost optimization
  - CDN integration for fast delivery

### Sharp
- **Purpose:** High-performance image processing for resizing, optimization, and format conversion
- **Rationale:** Sharp is the fastest Node.js image processing library (libvips-based), essential for creating responsive image variants (thumbnails, mobile, desktop) and reducing bandwidth costs.
- **Use Cases:**
  - Thumbnail generation
  - Image resizing for responsive delivery
  - Format conversion (WebP optimization)
  - Image compression

### Multer
- **Purpose:** Middleware for handling multipart/form-data file uploads
- **Rationale:** Standard Express middleware for file uploads with support for multiple files, file filtering, and memory/disk storage options
- **Implementation:** Memory storage for direct S3/R2 upload without disk writes

## Testing

### Vitest
- **Purpose:** Unit and integration testing framework for TypeScript/JavaScript
- **Rationale:** Vitest provides Vite-powered fast test execution, native TypeScript support, Jest-compatible API, and excellent developer experience with watch mode and coverage reporting
- **Testing Patterns:**
  - Unit tests for services and utilities
  - Repository tests with test database
  - Endpoint integration tests

### Supertest
- **Purpose:** HTTP assertion library for testing Express endpoints
- **Rationale:** Supertest enables full integration testing of API endpoints, middleware chains, and error handling without manual server management
- **Use Cases:**
  - End-to-end API endpoint testing
  - Middleware integration testing
  - Authentication flow testing

## Error Handling

### safeExecute Utility
- **Purpose:** Tuple-based error handling eliminating try/catch blocks
- **Rationale:** Provides Go-style error handling `[Error] | [undefined, T]` that forces explicit error checking, improves code readability, and prevents unhandled promise rejections
- **Pattern:** `const [error, result] = await safeExecute(promise)`
- **Use Cases:**
  - Database operations
  - File system operations
  - External API calls
  - Cloud service operations
  - Any Promise that might reject

## API Documentation

### Swagger / OpenAPI
- **Purpose:** API documentation generation and interactive API explorer
- **Rationale:** OpenAPI specification provides standardized API documentation, client SDK generation, and interactive testing interface for developers and integrators
- **Features:**
  - Auto-generated from route definitions
  - Request/response schema documentation
  - Interactive API testing
  - Client code generation support

## Architectural Patterns

### Handler Factory Pattern
- **Purpose:** Dependency injection for route handlers enabling testability and loose coupling
- **Implementation:** Handlers are factory functions that accept dependencies (services, repositories) and return Express handlers
- **Benefits:** Testable handlers, clear dependencies, no global state

### Request-Scoped Logging
- **Purpose:** Automatic correlation ID propagation and request context in logs
- **Implementation:** Middleware attaches logger to `req.log` with correlation ID, all subsequent logs include request context
- **Benefits:** Trace requests across multiple services, debug production issues, audit trails

### Outbox Pattern
- **Purpose:** Reliable event publishing for Keycloak events and domain events
- **Implementation:** Events written to database outbox table, then published asynchronously
- **Benefits:** Guaranteed event delivery, transactional consistency, decoupled event processing

## Future Technical Considerations

### Real-Time Communication (Phase 2)
- **Technology Options:**
  - **WebSockets** (Socket.IO): Full bidirectional communication for prayer wall real-time updates
  - **Server-Sent Events (SSE):** Simpler unidirectional updates for notifications
- **Use Cases:** Real-time prayer wall updates, notification delivery, presence indicators

### Video Conferencing (Phase 3)
- **Technology Options:**
  - **WebRTC:** Peer-to-peer video calls with TURN/STUN servers
  - **Third-party SDKs:** Twilio Video, Daily.co, Agora for managed infrastructure
- **Infrastructure Needs:** TURN servers, media relay servers, bandwidth management, recording storage

### Mobile Optimization
- **GraphQL Consideration:** Evaluate GraphQL for flexible mobile queries and reduced over-fetching
- **API Versioning:** Implement versioning strategy for mobile API stability
- **Offline Support:** Consider offline-first architecture with background sync

### Scalability Enhancements
- **Message Queue:** Redis Pub/Sub or dedicated queue (RabbitMQ, SQS) for background jobs
- **Database Scaling:** Read replicas for query-heavy operations, connection pooling optimization
- **CDN Integration:** CloudFront or Cloudflare for static asset and API caching
- **Microservices:** Consider splitting prayer wall or video features into separate services at scale

## Development Tools

### Migration Management
- **Database Migrations:** SQL-based migrations with version control for schema evolution
- **Migration Strategy:** Forward-only migrations, no destructive changes in production

### Code Quality
- **TypeScript Compiler:** Strict mode enabled for maximum type safety
- **ESLint:** Code quality and consistency enforcement
- **Prettier:** Automated code formatting
- **CodeRabbit CLI:** Automated code review tool for quality checks

### Development Workflow
- **TDD (Test-Driven Development):** Required development practice per project standards
- **Context7 MCP Server:** Documentation fetching for latest library docs
- **Git Hooks:** Pre-commit validation and testing