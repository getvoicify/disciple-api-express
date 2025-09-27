import request from 'supertest';
import express from 'express';
import { swaggerSpec } from '../config/swagger.config';
import yaml from 'js-yaml';

describe('OpenAPI Spec Export Endpoints', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();

        // Add the endpoints we'll be implementing
        app.get('/api/openapi.json', (req, res) => {
            res.json(swaggerSpec);
        });

        app.get('/api/openapi.yaml', (req, res) => {
            res.set('Content-Type', 'text/yaml');
            res.send(yaml.dump(swaggerSpec));
        });
    });

    describe('GET /api/openapi.json', () => {
        it('should return OpenAPI spec as JSON', async () => {
            const response = await request(app)
                .get('/api/openapi.json')
                .expect(200)
                .expect('Content-Type', /json/);

            expect(response.body).toHaveProperty('openapi');
            expect(response.body).toHaveProperty('info');
            expect(response.body.info).toHaveProperty('title');
            expect(response.body.info).toHaveProperty('version');
        });

        it('should include all required OpenAPI properties', async () => {
            const response = await request(app)
                .get('/api/openapi.json')
                .expect(200);

            expect(response.body).toHaveProperty('openapi');
            expect(response.body).toHaveProperty('info');
            expect(response.body).toHaveProperty('paths');
            expect(response.body).toHaveProperty('components');
            expect(response.body).toHaveProperty('servers');
        });
    });

    describe('GET /api/openapi.yaml', () => {
        it('should return OpenAPI spec as YAML with correct content type', async () => {
            const response = await request(app)
                .get('/api/openapi.yaml')
                .expect(200)
                .expect('Content-Type', /yaml/);

            // Just verify it's valid YAML by parsing it
            const parsed = yaml.load(response.text) as any;
            expect(parsed).toHaveProperty('openapi');
            expect(parsed).toHaveProperty('info');
        });

        it('should return valid YAML that matches the spec structure', async () => {
            const response = await request(app)
                .get('/api/openapi.yaml')
                .expect(200);

            const parsed = yaml.load(response.text) as any;
            expect(parsed).toHaveProperty('openapi');
            expect(parsed).toHaveProperty('info');
            expect(parsed.info).toHaveProperty('title');
            expect(parsed.info).toHaveProperty('version');
        });

        it('should contain the same data as JSON endpoint', async () => {
            const jsonResponse = await request(app)
                .get('/api/openapi.json')
                .expect(200);

            const yamlResponse = await request(app)
                .get('/api/openapi.yaml')
                .expect(200);

            const yamlParsed = yaml.load(yamlResponse.text);
            expect(yamlParsed).toEqual(jsonResponse.body);
        });
    });
});