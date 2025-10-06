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
import {postRoutes} from "./posts/routes";
import {PostgresSeriesRepository} from "./series/pg-repository";
import {SeriesServiceImpl} from "./series/service";
import {devotionalRouter} from "./series/routes/routes";
import {errorHandler, notFoundHandler} from "./middleware/error-handler.middleware";
import {usersRouter} from "./users/router";
import {setupKeycloakAdapter} from "./keycloak/setup";
import {KeycloakAdminConfig} from "./keycloak/admin-client";
import {safeExecute} from "./utils/handle-async";
import {createCacheRepository} from "./cache";
// Auth middleware setup for posts
import {jwtVerify} from 'jose';
import {validateToken} from "./utils/validate-token.middleware";

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
const noteService = new NoteServiceImpl(notesPgRepo);

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

const postRepository = new PostgresPostRepository(db, keycloakAdapter);
const postService = new PostServiceImpl(postRepository, churchMemberService);

const seriesRepository = new PostgresSeriesRepository(db);
const seriesService = new SeriesServiceImpl(seriesRepository, churchMemberService, postRepository);

const cacheRepository = createCacheRepository();

const app = express();
app.use(express.json());


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
		console.error('Database health check failed:', error);
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
		console.error('Redis health check failed:', error);
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

const tokenVerifier = validateToken(jwtVerify, IAM_ENDPOINT, IAM_REALM);

app.use('/api/churches', churchesRouter(churchService, churchApprovalService, churchMemberService, galleryService));
app.use('/api/notes', notesRouter(noteService));
app.use('/api/users', usersRouter(churchMemberService));
app.use('/api/media', mediaRouter(mediaRepository, mediaUploadService));
app.use('/api/posts', postRoutes(
  postService,
  tokenVerifier(),
  seriesService,
));
app.use('/api/devotional', devotionalRouter(seriesService));
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});

const sigEndSub = new Subject<void>();

interval(1000 * 15).pipe(
	concatMap(
		() => defer(() => safeExecute(outbox.processDue())).pipe(
			tap(([err]) => {
				if (err) {
					console.error('Error processing due events:', err);
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
