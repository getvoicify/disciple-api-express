import express from 'express';
import swaggerUi from 'swagger-ui-express';
import dotenv from 'dotenv';
import {getRawDb} from "./utils/database";
import {notesRouter} from "./notes/routes/routes";
import {PostgresNoteRepository} from "./notes/pg-repository";
import {NoteServiceImpl} from "./notes/service";
import { swaggerSpec } from './config/swagger.config';

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
const notesPgRepo = new PostgresNoteRepository(db);
const noteService = new NoteServiceImpl(notesPgRepo);

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

app.use('/api/notes', notesRouter(noteService));
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
