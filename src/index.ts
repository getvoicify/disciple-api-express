import express from 'express';
import swaggerUi from 'swagger-ui-express';
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
import {errorHandler, notFoundHandler} from "./middleware/error-handler.middleware";
import {usersRouter} from "./users/router";
import {setupKeycloakAdapter} from "./keycloak/setup";
import {KeycloakAdminConfig} from "./keycloak/admin-client";
import {safeExecute} from "./utils/handle-async";

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

const app = express();
app.use(express.json());


/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     description: Check if the API and database are running and healthy
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API and database are healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: "healthy"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *               version: "1.0.0"
 *               database: "connected"
 *               uptime: 3600.5
 *       503:
 *         description: API is unhealthy (database connection failed)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             example:
 *               status: "unhealthy"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *               version: "1.0.0"
 *               database: "disconnected"
 *               uptime: 3600.5
 */
app.get('/api/health', async (req, res) => {
	const timestamp = new Date().toISOString();
	let dbStatus: string;

	try {
		// Ping the database with a simple query
		await db`SELECT 1 as ping`;
		dbStatus = 'connected';
	} catch (error) {
		console.error('Database health check failed:', error);
		dbStatus = 'disconnected';
	}

	const isHealthy = dbStatus === 'connected';
	const status = isHealthy ? 'healthy' : 'unhealthy';

	const version = process.env.APP_VERSION || process.env.npm_package_version || '0.0.0-development';

	res.status(isHealthy ? 200 : 503).json({
		status,
		timestamp,
		version,
		database: dbStatus,
		uptime: process.uptime(),
		environment: process.env.NODE_ENV || 'development',
		buildDate: process.env.BUILD_DATE,
		commitSha: process.env.COMMIT_SHA
	});
});

app.use('/api/churches', churchesRouter(churchService, churchApprovalService, churchMemberService));
app.use('/api/notes', notesRouter(noteService));
app.use('/api/users', usersRouter(churchMemberService));
app.use('/api/media', mediaRouter(mediaRepository, mediaUploadService));
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
