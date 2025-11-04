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
import {setupKeycloakAdapter} from "./keycloak/setup";
import {type KeycloakAdminConfig} from "./keycloak/admin-client";
import {safeExecute} from "./utils/handle-async";
import {createCacheRepository, CacheInvalidationService, type ICacheInvalidationService} from "./cache";
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
import {createChurchMembershipSyncQueue} from "./queues/church-membership-sync/queue";
import {setupChurchMembershipOutboxAdapter} from "./churches/church-membership-outbox.setup";
import type { ChurchMembershipOutboxAdapter } from "./churches/church-membership-outbox.adapter";

dotenv.config();

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
	REDIS_URL: redisUrl
} = process.env;

const gb = new GrowthBookClient({
	apiHost,
	clientKey,
})

const db = getRawDb({DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT});
gb.init({timeout: 3000}).catch((e) => {
	logger.error({error: e}, 'GrowthBook initialization failed');
});

const {
	IAM_ENDPOINT,
	IAM_REALM,
} = process.env;

const keycloakConfig = {
	realm: IAM_REALM,
	keycloakUrl: IAM_ENDPOINT.replace('realms', ''),
	clientId: process.env.KEYCLOAK_CLIENT_ID,
	clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
} satisfies KeycloakAdminConfig;

const {adapter: keycloakAdapter, outbox, queue: keycloakOutboxQueue} = setupKeycloakAdapter(db, keycloakConfig, redisUrl);
const notesPgRepo = new PostgresNoteRepository(db, keycloakAdapter);

const churchRepository = new PostgresChurchRepository(db);
const churchMemberRepository = new PostgresChurchMemberRepository(db);

const churchService = new ChurchServiceImpl(churchRepository);
const churchMemberService = new ChurchMembershipServiceImpl(churchRepository, churchMemberRepository);
const churchApprovalService = new ChurchApprovalServiceImpl(churchRepository);

// Church Membership Sync Queue and Outbox setup
// Only create the queue if Redis URL is configured (production/staging)
let churchMembershipOutboxAdapter:
	ChurchMembershipOutboxAdapter | undefined;
if (redisUrl) {
	const churchMembershipSyncQueue = createChurchMembershipSyncQueue({
		connection: {
			url: redisUrl,
		},
	});
	churchMembershipOutboxAdapter = setupChurchMembershipOutboxAdapter(db, churchMembershipSyncQueue);
	logger.info('Church membership sync queue and outbox adapter initialized');
} else {
	logger.warn('Redis URL not configured - church membership sync events will not be emitted');
}

const mediaRepository = new PostgresMediaRepository(db, keycloakAdapter);
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

const postRepository = new PostgresPostRepository(db, keycloakAdapter);
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
// Excludes health check endpoint to reduce noise
const requestLogger = createRequestLoggingMiddleware(loggerFactory, {
	excludePaths: ['/api/health']
});
app.use(requestLogger);

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the API, database, and Redis cache are running and healthy
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
app.get('/api/health', async (req, res) => {
	const timestamp = new Date().toISOString();
	let dbStatus: string;
	let redisStatus: string;

	try {
		// Ping the database with a simple query
		await db`SELECT 1 as ping`;
		dbStatus = 'connected';
	} catch (error) {
		logger.error({error}, 'Database health check failed');
		dbStatus = 'disconnected';
	}

	// Check Redis/Cache health
	try {
		const isRedisHealthy = await cacheRepository.ping();
		const nodeEnv = process.env.NODE_ENV || 'development';
		if (nodeEnv === 'development') {
			redisStatus = 'in-memory';
		} else {
			redisStatus = isRedisHealthy ? 'connected' : 'disconnected';
		}
	} catch (error) {
		logger.error({error}, 'Redis health check failed');
		redisStatus = 'disconnected';
	}

	// Determine overall health status
	const isDbHealthy = dbStatus === 'connected';
	const isCacheHealthy = redisStatus === 'connected' || redisStatus === 'in-memory';

	let status: string;
	let statusCode: number;

	if (isDbHealthy && isCacheHealthy) {
		status = 'healthy';
		statusCode = 200;
	} else if (isDbHealthy || isCacheHealthy) {
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

app.use('/api/churches', churchesRouter(churchService, churchApprovalService, churchMemberService, postService, cacheRepository, galleryService, churchMembershipOutboxAdapter));
// Initialize Socket.io server with Keycloak JWT authentication
// Must be initialized before registering routes that use WebSocket broadcasting
const io = initializeSocketServer(httpServer, {
	redisUrl: process.env.REDIS_URL,
	iamEndpoint: IAM_ENDPOINT,
	iamRealm: IAM_REALM
});

app.use('/api/notes', notesRouter(noteService));
app.use('/api/users', usersRouter(churchMemberService));
app.use('/api/media', mediaRouter(mediaRepository, mediaUploadService));
app.use('/api/posts', postsRouter(postService, seriesService));
app.use('/api/devotional', devotionalRouter(seriesService));
app.use('/api', wallsRouter(prayerWallService));
app.use('/api', prayersRouter(prayerRequestService, io));
app.use('/api', moderationRouter(moderationService, prayerRequestRepository, io));
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(notFoundHandler);
app.use(errorHandler);

httpServer.listen(PORT, () => {
	logger.info({port: PORT}, 'Server started with WebSocket support');
});

// Setup fallback repeatable job for Keycloak outbox processing (every 10 seconds)
// This catches any events that might have been missed by the event-driven triggers
if (keycloakOutboxQueue) {
	keycloakOutboxQueue.upsertJobScheduler(
		'keycloak-outbox-fallback',
		{ pattern: '*/10 * * * * *' }, // Every 10 seconds
		{
			data: {
				triggeredAt: Date.now(),
			},
		}
	).then(() => {
		logger.info('Keycloak outbox fallback job scheduled (every 10 seconds)');
	}).catch((error) => {
		logger.error({ error: error.message }, 'Failed to schedule fallback job');
	});
}
