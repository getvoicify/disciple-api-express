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
        servers: (() => {
            // Show only the relevant server for the current environment
            if (process.env.PR_NUMBER) {
                // Preview environment
                return [{
                    url: `https://pr-${process.env.PR_NUMBER}.preview.infra.api.pottersville.church/api`,
                    description: `Preview server (PR #${process.env.PR_NUMBER})`,
                }];
            } else if (process.env.NODE_ENV === 'production') {
                // Production environment
                return [{
                    url: 'https://infra.api.pottersville.church/api',
                    description: 'Production server',
                }];
            } else if (process.env.NODE_ENV === 'staging') {
                // Staging environment
                return [{
                    url: 'https://staging.infra.api.pottersville.church/api',
                    description: 'Staging server',
                }];
            } else {
                // Local development (default)
                return [{
                    url: `http://localhost:${process.env.PORT || 3001}/api`,
                    description: 'Local development server',
                }];
            }
        })(),
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
                name: 'Churches',
                description: 'Operations related to church management and membership'
            },
            {
                name: 'Users',
                description: 'Operations related to user accounts and user-specific data'
            },
            {
                name: 'Church Membership',
                description: 'Operations related to church membership management'
            },
            {
                name: 'Health',
                description: 'Health check and system status endpoints'
            }
        ]
    },
    apis: process.env.NODE_ENV === 'development'
        ? ['./src/**/*endpoint.ts', './src/index.ts']
        : ['./dist/**/*endpoint.js', './dist/index.js'],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
export { swaggerOptions };