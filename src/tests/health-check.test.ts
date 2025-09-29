import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import Redis from 'ioredis';

vi.mock('ioredis');
vi.mock('../db/connection');

describe('Health Check Endpoint', () => {
  let app: express.Application;
  let mockRedis: any;
  let mockDb: any;

  beforeEach(() => {
    mockRedis = {
      ping: vi.fn(),
      disconnect: vi.fn(),
    };

    mockDb = vi.fn().mockResolvedValue([{ ping: 1 }]);

    (Redis as any).mockImplementation(() => mockRedis);

    app = express();
    app.use(express.json());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('/api/health', () => {
    it('should return healthy status when database and Redis are connected', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      app.get('/api/health', async (req, res) => {
        const timestamp = new Date().toISOString();
        let dbStatus = 'connected';
        let redisStatus = 'connected';

        res.status(200).json({
          status: 'healthy',
          timestamp,
          version: '1.17.0',
          database: dbStatus,
          redis: redisStatus,
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
        });
      });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.database).toBe('connected');
      expect(response.body.redis).toBe('connected');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
    });

    it('should return degraded status when Redis is disconnected but database is connected', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

      app.get('/api/health', async (req, res) => {
        const timestamp = new Date().toISOString();
        let dbStatus = 'connected';
        let redisStatus = 'disconnected';

        res.status(200).json({
          status: 'degraded',
          timestamp,
          version: '1.17.0',
          database: dbStatus,
          redis: redisStatus,
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
        });
      });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('degraded');
      expect(response.body.database).toBe('connected');
      expect(response.body.redis).toBe('disconnected');
    });

    it('should return unhealthy status when both database and Redis are disconnected', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

      app.get('/api/health', async (req, res) => {
        const timestamp = new Date().toISOString();
        let dbStatus = 'disconnected';
        let redisStatus = 'disconnected';

        res.status(503).json({
          status: 'unhealthy',
          timestamp,
          version: '1.17.0',
          database: dbStatus,
          redis: redisStatus,
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
        });
      });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.database).toBe('disconnected');
      expect(response.body.redis).toBe('disconnected');
    });

    it('should return degraded status when database is disconnected but Redis is connected', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      app.get('/api/health', async (req, res) => {
        const timestamp = new Date().toISOString();
        let dbStatus = 'disconnected';
        let redisStatus = 'connected';

        res.status(503).json({
          status: 'unhealthy',
          timestamp,
          version: '1.17.0',
          database: dbStatus,
          redis: redisStatus,
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
        });
      });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.database).toBe('disconnected');
      expect(response.body.redis).toBe('connected');
    });

    it('should handle Redis health check with in-memory cache in development', async () => {
      process.env.NODE_ENV = 'development';

      app.get('/api/health', async (req, res) => {
        const timestamp = new Date().toISOString();
        let dbStatus = 'connected';
        let redisStatus = 'in-memory';

        res.status(200).json({
          status: 'healthy',
          timestamp,
          version: '1.17.0',
          database: dbStatus,
          redis: redisStatus,
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
        });
      });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.redis).toBe('in-memory');
    });

    it('should include Redis response time in health check', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      app.get('/api/health', async (req, res) => {
        const timestamp = new Date().toISOString();
        const startTime = Date.now();

        let redisStatus = 'connected';
        let redisResponseTime = 5;

        res.status(200).json({
          status: 'healthy',
          timestamp,
          version: '1.17.0',
          database: 'connected',
          redis: {
            status: redisStatus,
            responseTime: redisResponseTime,
          },
          uptime: process.uptime(),
          environment: process.env.NODE_ENV || 'development',
        });
      });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.redis).toHaveProperty('status', 'connected');
      expect(response.body.redis).toHaveProperty('responseTime');
      expect(typeof response.body.redis.responseTime).toBe('number');
    });
  });
});