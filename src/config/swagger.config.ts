import swaggerJsdoc from 'swagger-jsdoc';
import { openApiSchemas } from '../schemas/openapi.schemas';

const swaggerOptions: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Disciple API',
            version: '1.0.0',
            description: 'Church and worship API for managing notes, scripture references, and church community',
            contact: {
                name: 'API Support',
                email: 'support@pottersville.church'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: `http://localhost:3001/api`,
                description: 'Local development server',
            },
            {
                url: `https://staging.infra.api.pottersville.church/api`,
                description: 'Staging server',
            },
            {
                url: 'https://infra.api.pottersville.church/api',
                description: 'Production server',
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token for authentication'
                }
            },
            schemas: openApiSchemas
        },
        tags: [
            {
                name: 'Notes',
                description: 'Operations related to sermon notes and scripture references'
            },
            {
                name: 'Health',
                description: 'Health check and system status endpoints'
            }
        ]
    },
    apis: ['./src/**/*endpoint.ts', './src/index.ts'],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
export { swaggerOptions };