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

## 🔌 WebSocket API

This API provides real-time communication for prayer walls using Socket.io with JWT authentication.

### Quick Start

**What's Real-Time?**
- Live prayer updates (create, edit, delete)
- User presence (online/offline status)
- Typing indicators
- Read receipts
- Moderation notifications
- Membership changes

### Connection & Authentication

Connect to the WebSocket server using Socket.io client with your JWT token:

**TypeScript/JavaScript (Web)**
```typescript
import { io, Socket } from 'socket.io-client';

// Recommended: Use auth object
const socket: Socket = io('wss://api.example.com', {
  auth: {
    token: 'your-jwt-token'
  },
  transports: ['websocket', 'polling']
});

// Connection events
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

**Flutter (Mobile)**
```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

// Create socket connection
IO.Socket socket = IO.io('wss://api.example.com', <String, dynamic>{
  'auth': {'token': 'your-jwt-token'},
  'transports': ['websocket', 'polling'],
  'autoConnect': false,
});

// Connection handlers
socket.on('connect', (_) {
  print('Connected: ${socket.id}');
});

socket.on('connect_error', (error) {
  print('Connection failed: $error');
});

// Connect manually
socket.connect();
```

**Alternative Authentication Methods:**
```typescript
// Option 2: Query parameter
io('wss://api.example.com?token=your-jwt-token');

// Option 3: Authorization header
io('wss://api.example.com', {
  extraHeaders: {
    Authorization: 'Bearer your-jwt-token'
  }
});
```

### Rooms & Walls

Prayer walls use **room-based communication**. Each prayer wall has a unique ID that serves as its room:

```typescript
// Join a prayer wall room
socket.emit('join-room', { roomId: 'wall-id-123' });

// Listen for confirmation
socket.on('room-joined', (data) => {
  console.log('Joined wall:', data.roomId);
});

// Leave a room
socket.emit('leave-room', { roomId: 'wall-id-123' });

socket.on('room-left', (data) => {
  console.log('Left wall:', data.roomId);
});
```

### Key Events Reference

| Event | Direction | Description |
|-------|-----------|-------------|
| **Room Management** |
| `join-room` | Client → Server | Join a prayer wall room |
| `leave-room` | Client → Server | Leave a prayer wall room |
| `room-joined` | Server → Client | Confirmation of joining |
| `room-left` | Server → Client | Confirmation of leaving |
| **Prayers** |
| `prayer:created` | Server → Clients | New prayer posted |
| `prayer:updated` | Server → Clients | Prayer content edited |
| `prayer:deleted` | Server → Clients | Prayer removed |
| `prayer:response` | Server → Clients | Response added to prayer |
| `prayer:reply` | Server → Clients | Reply added to response |
| `prayer:read` | Server → Clients | Prayer read receipt |
| **Presence** |
| `user:online` | Server → Clients | User joined wall |
| `user:offline` | Server → Clients | User left wall |
| `typing:start` | Server → Clients | User started typing |
| `typing:stop` | Server → Clients | User stopped typing |
| **Moderation** |
| `content:flagged` | Server → Pastors | Content flagged for review |
| `content:hidden` | Server → Clients | Content hidden from view |
| `content:restored` | Server → Clients | Content unhidden |
| `user:banned` | Server → Clients | User banned from wall |
| **Membership** |
| `member:joined` | Server → Clients | New member joined wall |
| `member:left` | Server → Clients | Member left wall |
| `member:invited` | Server → Clients | Member invited to wall |

### Event Payload Types

**TypeScript Interfaces:**
```typescript
// Prayer created event
interface PrayerCreatedPayload {
  prayerId: string;
  wallId: string;
  content: string;
  authorId?: string;       // undefined if anonymous
  authorName?: string;     // undefined if anonymous
  isAnonymous: boolean;
  createdAt: string;       // ISO 8601 timestamp
}

// User presence event
interface UserOnlinePayload {
  userId: string;
  userName?: string;
  wallId: string;
  timestamp: string;
}

// Typing indicator events
interface TypingStartPayload {
  wallId: string;
  userId: string;
  userName?: string;
  prayerId?: string;       // Optional: typing on specific prayer
}

interface TypingStopPayload {
  wallId: string;
  userId: string;
  prayerId?: string;       // Optional: typing on specific prayer
}

// Read receipt event
interface PrayerReadPayload {
  prayerId: string;
  wallId: string;
  userId: string;
  readAt: string;
  readCount: number;       // Total readers
}

// Content moderation event
interface ContentHiddenPayload {
  contentId: string;
  contentType: 'prayer' | 'response' | 'reply';
  wallId: string;
  hiddenBy: string;
  reason: string;
  timestamp: string;
}
```

**Flutter/Dart Types:**
```dart
class PrayerCreatedPayload {
  final String prayerId;
  final String wallId;
  final String content;
  final String? authorId;
  final String? authorName;
  final bool isAnonymous;
  final String createdAt;

  PrayerCreatedPayload.fromJson(Map<String, dynamic> json)
    : prayerId = json['prayerId'],
      wallId = json['wallId'],
      content = json['content'],
      authorId = json['authorId'],
      authorName = json['authorName'],
      isAnonymous = json['isAnonymous'],
      createdAt = json['createdAt'];
}
```

### Usage Examples

**TypeScript - Listening to Prayer Events:**
```typescript
// Listen for new prayers
socket.on('prayer:created', (payload: PrayerCreatedPayload) => {
  console.log('New prayer:', payload.content);
  if (payload.isAnonymous) {
    console.log('Posted anonymously');
  } else {
    console.log('By:', payload.authorName);
  }
});

// Listen for presence changes
socket.on('user:online', (payload: UserOnlinePayload) => {
  console.log(`${payload.userName} joined the wall`);
});

// Track typing indicators
socket.on('typing:start', (payload: TypingStartPayload) => {
  console.log(`${payload.userName} is typing...`);
});

socket.on('typing:stop', (payload: TypingStopPayload) => {
  console.log(`${payload.userId} stopped typing`);
});
```

**Flutter - Complete Integration:**
```dart
// Setup event listeners
void setupSocketListeners(IO.Socket socket) {
  // Prayer events
  socket.on('prayer:created', (data) {
    final payload = PrayerCreatedPayload.fromJson(data);
    print('New prayer: ${payload.content}');
    // Update your UI
  });

  socket.on('prayer:updated', (data) {
    print('Prayer updated: ${data['prayerId']}');
  });

  // Presence events
  socket.on('user:online', (data) {
    print('User online: ${data['userName']}');
  });

  socket.on('user:offline', (data) {
    print('User offline: ${data['userId']}');
  });

  // Typing indicators
  socket.on('typing:start', (data) {
    print('${data['userName']} is typing...');
  });
}

// Join a prayer wall
void joinWall(IO.Socket socket, String wallId) {
  socket.emit('join-room', {'roomId': wallId});

  socket.once('room-joined', (data) {
    print('Successfully joined wall: ${data['roomId']}');
  });
}

// Clean up on dispose
@override
void dispose() {
  socket.emit('leave-room', {'roomId': currentWallId});
  socket.disconnect();
  super.dispose();
}
```

### Privacy & Anonymity

Prayer anonymity settings are automatically enforced in broadcasts:
- **`identified`** - Full name and user ID visible
- **`anonymous_to_members`** - Shows "Anonymous Member"
- **`fully_anonymous`** - Shows "Anonymous"

### Error Handling

**Connection Errors:**
```typescript
socket.on('connect_error', (error) => {
  if (error.message.includes('Authentication failed')) {
    // Token is invalid or expired - refresh and reconnect
  } else if (error.message.includes('timeout')) {
    // Network issue - retry connection
    socket.connect();
  }
});
```

**Common Issues:**
- **401 Unauthorized** - Missing or invalid JWT token
- **Connection timeout** - Check network or server status
- **Auto-disconnect** - Idle for >60 seconds (ping timeout)

### Configuration

**Server Settings:**
- **Ping timeout**: 60 seconds (auto-disconnect after idle)
- **Ping interval**: 25 seconds (keep-alive check)
- **Transports**: WebSocket with polling fallback
- **Scaling**: Redis adapter for multi-server deployments

### Testing

**Browser Console:**
```javascript
// Quick test connection
const socket = io('wss://localhost:3000', {
  auth: { token: 'your-token' }
});

socket.on('connect', () => console.log('✓ Connected'));
socket.emit('join-room', { roomId: 'test-wall-123' });
```

**Full event type definitions:** See `src/websocket/events.ts` for complete TypeScript types.

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

### Redis Configuration

**CRITICAL**: Redis MUST be configured with `maxmemory-policy noeviction` for BullMQ job queues to work reliably.

With the default `volatile-lru` eviction policy, Redis may evict job data under memory pressure, causing:
- Lost jobs
- Failed queue processing
- Data inconsistency

**Docker Compose (already configured)**:
```yaml
redis:
  command: redis-server --maxmemory-policy noeviction
```

**Managed Redis (AWS ElastiCache, Google Cloud Memorystore, etc.)**:
Set the `maxmemory-policy` parameter to `noeviction` in your Redis instance configuration.

**Verification**:
```bash
redis-cli CONFIG GET maxmemory-policy
# Should return: 1) "maxmemory-policy" 2) "noeviction"
```

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

### Code Patterns

#### Error Handling
All endpoints use the `errorCodeFactory` utility to determine appropriate HTTP status codes from errors:

```typescript
import errorCodeFactory from '../../utils/error-code.factory';

const [err, result] = await safeExecute(service.someOperation());
if (err) {
    const code = errorCodeFactory(err);  // Automatically determines 400, 403, 404, 500, etc.
    res.status(code).json({
        error: err.message,
        success: false,
    });
}
```

The factory checks for:
- Custom `statusCode` property on errors
- Error message patterns ("not found" → 404, "unauthorized" → 401, "forbidden" → 403)
- Defaults to 400 for unknown errors

#### Input Validation
All endpoints use Zod `.safeParse()` for input validation to avoid throwing errors:

```typescript
const parseResult = InputSchema.safeParse(req.body);
if (!parseResult.success) {
    res.status(400).json({
        error: parseResult.error.message,
        success: false,
    });
    return;
}
```

#### Safe Execution
Use the `safeExecute` utility for all async operations that might fail:

```typescript
import {safeExecute} from '../../utils/handle-async';

const [err, result] = await safeExecute(someAsyncOperation());
if (err) {
    // handle error
}
// use result safely
```

#### Interface-Based Services
Services should implement interfaces to improve testability and enable proper mocking:

```typescript
// Define interface with generic methods
export interface ICacheInvalidationService {
  invalidateResource(resource: string, id: string): Promise<void>;
  invalidateList(resource: string): Promise<void>;
  invalidateAll(resource: string): Promise<void>;
}

// Concrete implementation
export class CacheInvalidationService implements ICacheInvalidationService {
  async invalidateResource(resource: string, id: string): Promise<void> {
    // implementation
  }

  async invalidateList(resource: string): Promise<void> {
    // implementation
  }

  async invalidateAll(resource: string): Promise<void> {
    // implementation
  }
}

// Use in tests with type-safe mocks
const mockService: ICacheInvalidationService = {
  invalidateResource: jest.fn(),
  invalidateList: jest.fn(),
  invalidateAll: jest.fn(),
};
```

**Benefits:**
- **Type safety** - Ensures mocks match the actual service contract
- **Easier testing** - Mock objects can be typed as the interface
- **Better refactoring** - Changes to the interface are caught at compile time
- **Dependency injection** - Services can depend on interfaces rather than concrete implementations

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