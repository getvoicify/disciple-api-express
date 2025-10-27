import express from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import dotenv from 'dotenv';
import {concatMap, defer, interval, Subject, takeUntil, tap} from 'rxjs';
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
import {createCacheRepository, CacheInvalidationService} from "./cache";
import {logger, loggerFactory, createRequestLoggingMiddleware} from "./logging";
import {wallsRouter} from "./prayer-walls/routes/walls.routes";
import {PrayerWallService} from "./prayer-walls/services/prayer-wall.service";
import {PrayerWallRepository} from "./prayer-walls/repositories/prayer-wall.repository";
import {PrayerWallMembershipRepository} from "./prayer-walls/repositories/prayer-wall-membership.repository";

dotenv.config();

const {
	PORT,
	POSTGRES_DB: DB_NAME,
	POSTGRES_USER: DB_USER,
	POSTGRES_PASSWORD: DB_PASSWORD,
	DB_HOST,
	DB_PORT,
} = process.env;

const db = getRawDb({DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT});

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

const {adapter: keycloakAdapter, outbox} = setupKeycloakAdapter(db, keycloakConfig);
const notesPgRepo = new PostgresNoteRepository(db, keycloakAdapter);

const churchRepository = new PostgresChurchRepository(db);
const churchMemberRepository = new PostgresChurchMemberRepository(db);

const churchService = new ChurchServiceImpl(churchRepository);
const churchMemberService = new ChurchMembershipServiceImpl(churchRepository, churchMemberRepository);
const churchApprovalService = new ChurchApprovalServiceImpl(churchRepository);

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
const cacheInvalidationService = new CacheInvalidationService(cacheRepository, process.env.NODE_ENV || 'development');

const noteService = new NoteServiceImpl(notesPgRepo, cacheInvalidationService);

const postRepository = new PostgresPostRepository(db, keycloakAdapter);
const postService = new PostServiceImpl(postRepository, churchMemberService, cacheInvalidationService);

const seriesRepository = new PostgresSeriesRepository(db);
const seriesService = new SeriesServiceImpl(seriesRepository, churchMemberService, postRepository);

// Prayer Walls setup
const prayerWallRepository = new PrayerWallRepository(db);
const prayerWallMembershipRepository = new PrayerWallMembershipRepository(db);
const prayerWallService = new PrayerWallService(
	prayerWallRepository,
	prayerWallMembershipRepository,
	cacheRepository,
	churchMemberService
);

const app = express();
app.use(express.json());

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
 *                   timestamp: "2024-01-15T10:30:00.000Z"
 *                   version: "1.0.0"
 *                   database: "connected"
 *                   redis: "connected"
 *                   uptime: 3600.5
 *                   environment: "production"
 *               degraded:
 *                 summary: Some services degraded
 *                 value:
 *                   status: "degraded"
 *                   timestamp: "2024-01-15T10:30:00.000Z"
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
 *               timestamp: "2024-01-15T10:30:00.000Z"
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
		logger.error({ error }, 'Database health check failed');
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
		logger.error({ error }, 'Redis health check failed');
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

app.use('/api/churches', churchesRouter(churchService, churchApprovalService, churchMemberService, postService, cacheRepository, galleryService));
app.use('/api/notes', notesRouter(noteService));
app.use('/api/users', usersRouter(churchMemberService));
app.use('/api/media', mediaRouter(mediaRepository, mediaUploadService));
app.use('/api/posts', postsRouter(postService, seriesService));
app.use('/api/devotional', devotionalRouter(seriesService));
app.use('/api', wallsRouter(prayerWallService));
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
	logger.info({ port: PORT }, 'Server started');
});

const sigEndSub = new Subject<void>();

interval(1000 * 15).pipe(
	concatMap(
		() => defer(() => safeExecute(outbox.processDue())).pipe(
			tap(([err]) => {
				if (err) {
					logger.error({ error: err }, 'Error processing due events');
				}
			})
		)
	),
	takeUntil(sigEndSub)
).subscribe();

const clearIntervalFn = () => {
	sigEndSub.next();
}

process.on('SIGINT', clearIntervalFn);
process.on('SIGTERM', clearIntervalFn);
