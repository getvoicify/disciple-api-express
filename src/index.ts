import express from 'express';
import {GrowthBookClient} from "@growthbook/growthbook";
import {createServer} from 'http';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import {getRawDb} from "./utils/database";
import {notesRouter} from "./notes/routes/routes";
import {PostgresNoteRepository} from "./notes/pg-repository";
import {NoteServiceImpl} from "./notes/service";
import {swaggerSpec} from './config/swagger.config';
import {PostgresChurchMemberRepository, PostgresChurchRepository} from "./churches/postgres-repository";
import {ChurchServiceImpl} from "./churches/service";
import {ChurchMembershipServiceImpl} from "./churches/membership-service";
import {ChurchApprovalServiceImpl} from "./churches/approval-service";
import {churchesRouter} from "./churches/routes/routes";
import {mediaRouter} from "./media/routes/routes";
import {PostgresMediaRepository} from "./media/pg-repository";
import {MediaUploadService} from "./media/media-upload-service";
import {CloudflareR2ServiceImpl} from "./media/cloudflare-r2-service";
import {PostgresGalleryRepository} from './gallery/pg-repository';
import {GalleryServiceImpl} from './gallery/service';
import {ThumbnailServiceImpl} from './gallery/thumbnail-service';
import {SharpThumbnailGenerator} from './gallery/sharp-thumbnail-generator';
import {FetchHttpClient} from './utils/http-client';
import {PostgresPostRepository} from "./posts/pg-repository";
import {PostServiceImpl} from "./posts/service";
import {postsRouter} from "./posts/routes/routes";
import {PostgresSeriesRepository} from "./series/pg-repository";
import {SeriesServiceImpl} from "./series/service";
import {devotionalRouter} from "./series/routes/routes";
import {errorHandler, notFoundHandler} from "./middleware/error-handler.middleware";
import {usersRouter} from "./users/router";
import {createCacheRepository, CacheInvalidationService, type ICacheInvalidationService} from "./cache";
import {RedisCacheRepository} from "./cache";
import {logger, loggerFactory, createRequestLoggingMiddleware} from "./logging";
import {wallsRouter} from "./prayer-walls/routes/walls.routes";
import {prayersRouter} from "./prayer-walls/routes/prayers.routes";
import {moderationRouter} from "./prayer-walls/routes/moderation.routes";
import {PrayerWallService} from "./prayer-walls/services/prayer-wall.service";
import {PrayerRequestService} from "./prayer-walls/services/prayer-request.service";
import {ModerationService} from "./prayer-walls/services/moderation.service";
import {PrayerWallRepository} from "./prayer-walls/repositories/prayer-wall.repository";
import {PrayerRequestRepository} from "./prayer-walls/repositories/prayer-request.repository";
import {PrayerWallMembershipRepository} from "./prayer-walls/repositories/prayer-wall-membership.repository";
import {FlaggedContentRepository} from "./prayer-walls/repositories/flagged-content.repository";
import {initializeSocketServer} from "./websocket/socket.server";
import {getUserIdFromRequest} from "./utils/get-user-id";
import {createAuthorizeMiddleware} from './authorization';
import {createResolvers} from './authorization/resolvers';
import {safeExecute} from './utils/handle-async';

dotenv.config();

// Validate required environment variables before any initialization
const REQUIRED_ENV_VARS = [
	'PORT',
	'IAM_ENDPOINT',
	'IAM_REALM',
	'POSTGRES_DB',
	'POSTGRES_USER',
	'POSTGRES_PASSWORD',
	'DB_HOST',
];

const missingVars = REQUIRED_ENV_VARS.filter((varName) => !process.env[varName]);
if (missingVars.length > 0) {
	logger.error({ missingVars }, 'Missing required environment variables');
	process.exit(1);
}

// Global handlers for unhandled errors - must be registered early
process.on('unhandledRejection', (reason: unknown) => {
	logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error: Error) => {
	logger.error({ error }, 'Uncaught exception - process will exit');
	process.exit(1);
});

const {
	PORT,
	POSTGRES_DB: DB_NAME,
	POSTGRES_USER: DB_USER,
	POSTGRES_PASSWORD: DB_PASSWORD,
	DB_HOST,
	DB_PORT,
	GB_API_HOST: apiHost,
	GB_CLIENT_KEY: clientKey,
	NODE_ENV: env,
	REDIS_URL: _redisUrl,
	IAM_ENDPOINT,
	IAM_REALM,
} = process.env;

const gb = new GrowthBookClient({
	apiHost,
	clientKey,
})

const db = getRawDb({DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT});
gb.init({timeout: 3000}).catch((e) => {
	logger.error({error: e}, 'GrowthBook initialization failed');
});

const resolvers = createResolvers(db);
const memberRoleLookup = async (churchId: string, userId: string) => {
	const result = await db`
		SELECT role FROM church_members
		WHERE church_id = ${churchId} AND user_id = ${userId} AND status = 'Active'
	`;
	return result.length > 0 ? result[0].role : null;
};
const authorize = createAuthorizeMiddleware(resolvers, memberRoleLookup);

const notesPgRepo = new PostgresNoteRepository(db);

const churchRepository = new PostgresChurchRepository(db);
const churchMemberRepository = new PostgresChurchMemberRepository(db);

const churchService = new ChurchServiceImpl(churchRepository);
const churchMemberService = new ChurchMembershipServiceImpl(churchRepository, churchMemberRepository);
const churchApprovalService = new ChurchApprovalServiceImpl(churchRepository);

const mediaRepository = new PostgresMediaRepository(db);
const r2Service = new CloudflareR2ServiceImpl();
const mediaUploadService = new MediaUploadService(mediaRepository, r2Service);

// Gallery setup
const galleryRepository = new PostgresGalleryRepository(db);
const httpClient = new FetchHttpClient();
const thumbnailGenerator = new SharpThumbnailGenerator();
const thumbnailService = new ThumbnailServiceImpl(r2Service, mediaRepository, httpClient, thumbnailGenerator);
const galleryService = new GalleryServiceImpl(galleryRepository, mediaRepository, thumbnailService);

const cacheRepository = createCacheRepository();
const cacheInvalidationService: ICacheInvalidationService = new CacheInvalidationService(cacheRepository, process.env.NODE_ENV || 'development');

const noteService = new NoteServiceImpl(notesPgRepo, cacheInvalidationService);

const postRepository = new PostgresPostRepository(db);
const postService = new PostServiceImpl(postRepository, churchMemberService, cacheInvalidationService);

const seriesRepository = new PostgresSeriesRepository(db);
const seriesService = new SeriesServiceImpl(seriesRepository, churchMemberService, postRepository);

// Prayer Walls setup
const prayerWallRepository = new PrayerWallRepository(db);
const prayerWallMembershipRepository = new PrayerWallMembershipRepository(db);
const prayerRequestRepository = new PrayerRequestRepository(db);
const flaggedContentRepository = new FlaggedContentRepository(db);

const prayerWallService = new PrayerWallService(
	prayerWallRepository,
	prayerWallMembershipRepository,
	cacheRepository,
	churchMemberService
);
const prayerRequestService = new PrayerRequestService(
	prayerRequestRepository,
	prayerWallMembershipRepository
);
const moderationService = new ModerationService(
	flaggedContentRepository,
	prayerRequestRepository,
	prayerWallMembershipRepository,
	prayerWallRepository,
	churchMemberService
);

const app = express();
const httpServer = createServer(app);

app.use(express.json());

app.use((req, _, next) => {
	const url = req.url;
	const userId = getUserIdFromRequest(req);
	req['growthbook'] = gb.createScopedInstance({
		attributes: {
			url,
			id: userId ?? 'anonymous',
			env: env !== 'development' ? env : 'dev',
		}
	});
	next();
});

// Add request logging middleware - logs all incoming requests and responses
// Excludes health check endpoints to reduce noise
const requestLogger = createRequestLoggingMiddleware(loggerFactory, {
	excludePaths: ['/api/health', '/api/livez', '/api/readyz']
});
app.use(requestLogger);

/**
 * @openapi
 * /livez:
 *   get:
 *     summary: Liveness probe
 *     description: Kubernetes liveness probe - returns 200 if the process is alive. No I/O checks performed.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Process is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: alive
 */
app.get('/api/livez', (_req, res) => {
	res.status(200).json({ status: 'alive' });
});

/**
 * @openapi
 * /readyz:
 *   get:
 *     summary: Readiness probe
 *     description: Kubernetes readiness probe - returns 200 if the application is ready to serve traffic (DB reachable). Cache status is informational only.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application is ready to serve traffic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *                 database:
 *                   type: boolean
 *                   example: true
 *                 cache:
 *                   type: boolean
 *                   example: true
 *       503:
 *         description: Application is not ready (database unreachable)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: not_ready
 *                 database:
 *                   type: boolean
 *                   example: false
 *                 cache:
 *                   type: boolean
 *                   example: false
 */
app.get('/api/readyz', async (_req, res) => {
	const [dbError] = await safeExecute(db`SELECT 1 as ping`);
	const dbHealthy = !dbError;

	if (dbError) {
		logger.error({ error: dbError }, 'Database readiness check failed');
	}

	const [cacheError, cacheResult] = await safeExecute(cacheRepository.ping());
	const cacheHealthy = !cacheError && !!cacheResult;

	if (cacheError) {
		logger.warn({ error: cacheError }, 'Cache readiness check failed');
	}

	const statusCode = dbHealthy ? 200 : 503;
	const status = dbHealthy ? 'ready' : 'not_ready';

	res.status(statusCode).json({
		status,
		database: dbHealthy,
		cache: cacheHealthy,
	});
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the API, database, and Redis cache are running and healthy. For monitoring dashboards - do NOT use as a Kubernetes probe.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API is healthy or degraded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             examples:
 *               healthy:
 *                 summary: All services healthy
 *                 value:
 *                   status: "healthy"
 *                   timestamp: "2025-01-15T10:30:00.000Z"
 *                   version: "1.0.0"
 *                   database: "connected"
 *                   redis: "connected"
 *                   uptime: 3600.5
 *                   environment: "production"
 *               degraded:
 *                 summary: Some services degraded
 *                 value:
 *                   status: "degraded"
 *                   timestamp: "2025-01-15T10:30:00.000Z"
 *                   version: "1.0.0"
 *                   database: "connected"
 *                   redis: "disconnected"
 *                   uptime: 3600.5
 *                   environment: "production"
 *       503:
 *         description: API is unhealthy (critical services failed)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: "unhealthy"
 *               timestamp: "2025-01-15T10:30:00.000Z"
 *               version: "1.0.0"
 *               database: "disconnected"
 *               redis: "disconnected"
 *               uptime: 3600.5
 *               environment: "production"
 */
app.get('/api/health', async (_req, res) => {
	const timestamp = new Date().toISOString();
	let dbStatus: string;
	let redisStatus: string;

	const [dbError] = await safeExecute(db`SELECT 1 as ping`);
	if (dbError) {
		logger.error({ error: dbError }, 'Database health check failed');
		dbStatus = 'disconnected';
	} else {
		dbStatus = 'connected';
	}

	// Check Redis/Cache health
	const [cacheError, isRedisHealthy] = await safeExecute(cacheRepository.ping());
	if (cacheError) {
		logger.error({ error: cacheError }, 'Redis health check failed');
		redisStatus = 'disconnected';
	} else {
		const nodeEnv = process.env.NODE_ENV || 'development';
		if (nodeEnv === 'development') {
			redisStatus = 'in-memory';
		} else {
			redisStatus = isRedisHealthy ? 'connected' : 'disconnected';
		}
	}

	// Determine overall health status
	// DB healthy + Cache healthy → 200 "healthy"
	// DB healthy + Cache down  → 200 "degraded" (acceptable)
	// DB down (regardless of cache) → 503 "unhealthy"
	const isDbHealthy = dbStatus === 'connected';
	const isCacheHealthy = redisStatus === 'connected' || redisStatus === 'in-memory';

	let status: string;
	let statusCode: number;

	if (isDbHealthy && isCacheHealthy) {
		status = 'healthy';
		statusCode = 200;
	} else if (isDbHealthy && !isCacheHealthy) {
		status = 'degraded';
		statusCode = 200;
	} else {
		status = 'unhealthy';
		statusCode = 503;
	}

	const version = process.env.APP_VERSION || process.env.npm_package_version || '0.0.0-development';

	res.status(statusCode).json({
		status,
		timestamp,
		version,
		database: dbStatus,
		redis: redisStatus,
		uptime: process.uptime(),
		environment: process.env.NODE_ENV || 'development',
		buildDate: process.env.BUILD_DATE,
		commitSha: process.env.COMMIT_SHA
	});
});

/**
 * @openapi
 * /openapi.json:
 *   get:
 *     summary: Export OpenAPI specification as JSON
 *     description: Returns the complete OpenAPI 3.0 specification in JSON format
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: OpenAPI specification in JSON format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: OpenAPI 3.0 specification object
 */
app.get('/api/openapi.json', (req, res) => {
	res.json(swaggerSpec);
});

/**
 * @openapi
 * /openapi.yaml:
 *   get:
 *     summary: Export OpenAPI specification as YAML
 *     description: Returns the complete OpenAPI 3.0 specification in YAML format
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: OpenAPI specification in YAML format
 *         content:
 *           text/yaml:
 *             schema:
 *               type: string
 *               description: OpenAPI 3.0 specification in YAML format
 */
app.get('/api/openapi.yaml', (req, res) => {
	res.set('Content-Type', 'text/yaml');
	res.send(yaml.dump(swaggerSpec));
});

app.use('/api/churches', churchesRouter(churchService, churchApprovalService, churchMemberService, postService, cacheRepository, galleryService));
// Initialize Socket.io server with JWT authentication
// Must be initialized before registering routes that use WebSocket broadcasting
const io = initializeSocketServer(httpServer, {
	redisUrl: process.env.REDIS_URL,
	iamEndpoint: IAM_ENDPOINT,
	iamRealm: IAM_REALM
});

app.use('/api/notes', notesRouter(noteService, authorize));
app.use('/api/users', usersRouter(churchMemberService));
app.use('/api/media', mediaRouter(mediaRepository, mediaUploadService));
app.use('/api/posts', postsRouter(postService, seriesService, authorize));
app.use('/api/devotional', devotionalRouter(seriesService, authorize));
app.use('/api', wallsRouter(prayerWallService));
app.use('/api', prayersRouter(prayerRequestService, io));
app.use('/api', moderationRouter(moderationService, prayerRequestRepository, io));
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(notFoundHandler);
app.use(errorHandler);

httpServer.listen(PORT, () => {
	logger.info({port: PORT}, 'Server started with WebSocket support');
});

// Graceful shutdown handler
const SHUTDOWN_TIMEOUT_MS = 30_000;

const shutdown = async (signal: string): Promise<void> => {
	logger.info({ signal }, 'Shutdown signal received - starting graceful shutdown');

	// Force-kill timeout in case graceful shutdown hangs
	const forceKillTimer = setTimeout(() => {
		logger.error({ signal, timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Graceful shutdown timed out - forcing exit');
		process.exit(1);
	}, SHUTDOWN_TIMEOUT_MS);

	// Ensure the timeout doesn't prevent the process from exiting naturally
	forceKillTimer.unref();

	try {
		// Stop accepting new connections
		await new Promise<void>((resolve, reject) => {
			httpServer.close((err) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});
		logger.info('HTTP server closed');

		// Close database connection pool
		await db.end();
		logger.info('Database connections closed');

		// Close Redis/cache connections if using Redis
		if (cacheRepository instanceof RedisCacheRepository) {
			await cacheRepository.disconnect();
			logger.info('Redis connections closed');
		}

		clearTimeout(forceKillTimer);
		logger.info('Graceful shutdown complete');
		process.exit(0);
	} catch (error) {
		logger.error({ error }, 'Error during graceful shutdown');
		process.exit(1);
	}
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
