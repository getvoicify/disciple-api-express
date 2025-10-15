/**
 * Stress Test Script for Daily Devotionals Endpoint
 *
 * This script performs a progressive load test against the daily devotionals API endpoint.
 * It ramps up from 10 req/sec to 100 req/sec over 10 minutes, sending ~31,200 requests total.
 *
 * Required Environment Variables (in .env file):
 * - STRESS_TEST_USERNAME: Username for authentication
 * - STRESS_TEST_PASSWORD: Password for authentication
 * - STRESS_TEST_CLIENT_ID or KEYCLOAK_CLIENT_ID: Keycloak client ID
 * - STRESS_TEST_CLIENT_SECRET or KEYCLOAK_CLIENT_SECRET: Keycloak client secret
 *
 * Optional Environment Variables:
 * - KEYCLOAK_URL: Keycloak token endpoint (default: https://keycloak.pottersville.church/realms/Pottersville/protocol/openid-connect/token)
 * - STRESS_TEST_TARGET_URL: Target API endpoint (default: https://staging.infra.api.pottersville.church/api/posts/daily-devotionals)
 *
 * Usage:
 *   npx tsx scripts/stress-test.ts
 *
 * Results are saved to: scripts/stress-test-results-{timestamp}.json
 */

import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { safeExecute } from '../src/utils/handle-async';

// Load environment variables from .env file
config();

// Load environment variables
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'https://keycloak.pottersville.church/realms/Pottersville/protocol/openid-connect/token';
const TARGET_URL = process.env.STRESS_TEST_TARGET_URL || 'https://staging.infra.api.pottersville.church/api/posts/daily-devotionals';
const CLIENT_ID = process.env.STRESS_TEST_CLIENT_ID || process.env.KEYCLOAK_CLIENT_ID;
const CLIENT_SECRET = process.env.STRESS_TEST_CLIENT_SECRET || process.env.KEYCLOAK_CLIENT_SECRET;
const USERNAME = process.env.STRESS_TEST_USERNAME;
const PASSWORD = process.env.STRESS_TEST_PASSWORD;

// Validate required environment variables
if (!CLIENT_ID || !CLIENT_SECRET || !USERNAME || !PASSWORD) {
  console.error('Missing required environment variables:');
  if (!CLIENT_ID) console.error('  - STRESS_TEST_CLIENT_ID or KEYCLOAK_CLIENT_ID');
  if (!CLIENT_SECRET) console.error('  - STRESS_TEST_CLIENT_SECRET or KEYCLOAK_CLIENT_SECRET');
  if (!USERNAME) console.error('  - STRESS_TEST_USERNAME');
  if (!PASSWORD) console.error('  - STRESS_TEST_PASSWORD');
  process.exit(1);
}

// Test configuration
const CONFIG = {
  keycloakUrl: KEYCLOAK_URL,
  targetUrl: TARGET_URL,
  credentials: {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    username: USERNAME,
    password: PASSWORD,
  },
  loadPhases: [
    { durationMs: 120000, requestsPerSecond: 10, name: 'Phase 1: Baseline' },       // 0-2 min: 10 req/s
    { durationMs: 120000, requestsPerSecond: 25, name: 'Phase 2: Warm Up' },        // 2-4 min: 25 req/s
    { durationMs: 120000, requestsPerSecond: 50, name: 'Phase 3: Moderate Load' },  // 4-6 min: 50 req/s
    { durationMs: 120000, requestsPerSecond: 75, name: 'Phase 4: Heavy Load' },     // 6-8 min: 75 req/s
    { durationMs: 120000, requestsPerSecond: 100, name: 'Phase 5: Peak Load' },     // 8-10 min: 100 req/s
  ],
  progressIntervalMs: 30000, // Log progress every 30 seconds
};

interface RequestMetric {
  timestamp: number;
  durationMs: number;
  statusCode?: number;
  success: boolean;
  error?: string;
  phase: string;
}

interface TestResults {
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  statusCodes: Record<number, number>;
  responseTimes: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  phaseResults: Array<{
    phase: string;
    requests: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
  }>;
  errors: Record<string, number>;
  metrics: RequestMetric[];
}

// Structured logger (following project conventions)
const logger = {
  info: (data: Record<string, unknown>, message: string) => {
    console.log(JSON.stringify({ level: 'info', ...data, message, timestamp: new Date().toISOString() }));
  },
  error: (data: Record<string, unknown>, message: string) => {
    console.error(JSON.stringify({ level: 'error', ...data, message, timestamp: new Date().toISOString() }));
  },
  warn: (data: Record<string, unknown>, message: string) => {
    console.warn(JSON.stringify({ level: 'warn', ...data, message, timestamp: new Date().toISOString() }));
  },
};

class StressTest {
  private accessToken: string = '';
  private metrics: RequestMetric[] = [];
  private startTime: number = 0;
  private statusCodes: Record<number, number> = {};
  private errors: Record<string, number> = {};
  private currentPhase: string = '';
  private tokenRefreshPromise: Promise<void> | null = null;

  async authenticate(): Promise<void> {
    logger.info({ url: CONFIG.keycloakUrl }, 'Authenticating with Keycloak');

    const [error, response] = await safeExecute(async () => {
      const res = await fetch(CONFIG.keycloakUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: CONFIG.credentials.clientId,
          client_secret: CONFIG.credentials.clientSecret,
          username: CONFIG.credentials.username,
          password: CONFIG.credentials.password,
        }).toString(),
      });

      if (!res.ok) {
        throw new Error(`Authentication failed with status ${res.status}`);
      }

      return res;
    });

    if (error) {
      logger.error({ error: error.message }, 'Authentication failed');
      throw error;
    }

    const [jsonError, data] = await safeExecute(response.json() as Promise<{ access_token: string }>);

    if (jsonError) {
      logger.error({ error: jsonError.message }, 'Failed to parse authentication response');
      throw jsonError;
    }

    this.accessToken = data.access_token;
    logger.info({ tokenLength: this.accessToken.length }, 'Authentication successful');
  }

  async makeRequest(): Promise<RequestMetric> {
    const startTime = Date.now();

    const [error, response] = await safeExecute(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const res = await fetch(CONFIG.targetUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If token expired (401), refresh and retry
      if (res.status === 401) {
        // Wait for any ongoing refresh or start a new one
        if (this.tokenRefreshPromise) {
          await this.tokenRefreshPromise;
        } else {
          this.tokenRefreshPromise = this.refreshToken();
          await this.tokenRefreshPromise;
          this.tokenRefreshPromise = null;
        }

        // Retry with new token
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);

        const retryRes = await fetch(CONFIG.targetUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          signal: retryController.signal,
        });

        clearTimeout(retryTimeoutId);

        // Read response body to complete the request
        await retryRes.text();

        return retryRes;
      }

      // Read response body to complete the request
      await res.text();

      return res;
    });

    const durationMs = Date.now() - startTime;

    if (error) {
      const errorMessage = error.message || 'Unknown error';

      // Try to extract status code from fetch error
      let statusCode: number | undefined;
      if (errorMessage.includes('abort')) {
        statusCode = 408; // Request Timeout
      }

      if (statusCode) {
        this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;
      }

      this.errors[errorMessage] = (this.errors[errorMessage] || 0) + 1;

      return {
        timestamp: startTime,
        durationMs,
        statusCode,
        success: false,
        error: errorMessage,
        phase: this.currentPhase,
      };
    }

    const statusCode = response.status;
    this.statusCodes[statusCode] = (this.statusCodes[statusCode] || 0) + 1;

    return {
      timestamp: startTime,
      durationMs,
      statusCode,
      success: response.ok,
      phase: this.currentPhase,
    };
  }

  async refreshToken(): Promise<void> {
    logger.info({}, 'Token expired, refreshing authentication');
    await this.authenticate();
  }

  async runPhase(phase: typeof CONFIG.loadPhases[0]): Promise<void> {
    this.currentPhase = phase.name;
    const intervalMs = 1000 / phase.requestsPerSecond;
    const phaseStartTime = Date.now();
    const phaseEndTime = phaseStartTime + phase.durationMs;
    let requestCount = 0;

    logger.info(
      {
        phase: phase.name,
        durationSeconds: phase.durationMs / 1000,
        requestsPerSecond: phase.requestsPerSecond,
        intervalMs,
      },
      'Starting load phase'
    );

    while (Date.now() < phaseEndTime) {
      const requestStartTime = Date.now();

      // Make request (fire and forget to maintain RPS)
      this.makeRequest().then((metric) => {
        this.metrics.push(metric);
      });

      requestCount++;

      // Wait for next request interval
      const elapsed = Date.now() - requestStartTime;
      const sleepTime = Math.max(0, intervalMs - elapsed);

      if (sleepTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, sleepTime));
      }
    }

    logger.info(
      { phase: phase.name, requestsSent: requestCount },
      'Load phase completed'
    );
  }

  calculateStatistics(): TestResults {
    const endTime = Date.now();
    const totalDurationMs = endTime - this.startTime;

    // Calculate response time statistics
    const successfulMetrics = this.metrics.filter((m) => m.success);
    const responseTimes = successfulMetrics.map((m) => m.durationMs).sort((a, b) => a - b);

    const min = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const max = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    const avg = responseTimes.length > 0
      ? responseTimes.reduce((sum, val) => sum + val, 0) / responseTimes.length
      : 0;
    const p95 = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length * 0.95)]
      : 0;
    const p99 = responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length * 0.99)]
      : 0;

    // Calculate per-phase statistics
    const phaseResults = CONFIG.loadPhases.map((phase) => {
      const phaseMetrics = this.metrics.filter((m) => m.phase === phase.name);
      const successful = phaseMetrics.filter((m) => m.success).length;
      const failed = phaseMetrics.length - successful;
      const avgResponseTime = phaseMetrics.length > 0
        ? phaseMetrics.reduce((sum, m) => sum + m.durationMs, 0) / phaseMetrics.length
        : 0;

      return {
        phase: phase.name,
        requests: phaseMetrics.length,
        successful,
        failed,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      };
    });

    return {
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      totalDurationMs,
      totalRequests: this.metrics.length,
      successfulRequests: this.metrics.filter((m) => m.success).length,
      failedRequests: this.metrics.filter((m) => !m.success).length,
      statusCodes: this.statusCodes,
      responseTimes: {
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        avg: Math.round(avg * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        p99: Math.round(p99 * 100) / 100,
      },
      phaseResults,
      errors: this.errors,
      metrics: this.metrics,
    };
  }

  printProgressReport(): void {
    const elapsed = Date.now() - this.startTime;
    const elapsedSeconds = Math.round(elapsed / 1000);
    const totalRequests = this.metrics.length;
    const successful = this.metrics.filter((m) => m.success).length;
    const failed = totalRequests - successful;
    const rps = totalRequests > 0 ? (totalRequests / (elapsed / 1000)).toFixed(2) : '0.00';

    logger.info(
      {
        elapsedSeconds,
        totalRequests,
        successful,
        failed,
        actualRPS: parseFloat(rps),
        currentPhase: this.currentPhase,
      },
      'Progress update'
    );
  }

  async run(): Promise<TestResults> {
    logger.info({ targetUrl: CONFIG.targetUrl }, 'Starting stress test');

    // Authenticate
    await this.authenticate();

    // Start test
    this.startTime = Date.now();

    // Set up progress reporting
    const progressInterval = setInterval(() => {
      this.printProgressReport();
    }, CONFIG.progressIntervalMs);

    try {
      // Run each load phase sequentially
      for (const phase of CONFIG.loadPhases) {
        await this.runPhase(phase);
      }

      // Wait a bit for any pending requests to complete
      await new Promise((resolve) => setTimeout(resolve, 5000));

    } finally {
      clearInterval(progressInterval);
    }

    // Calculate and return results
    const results = this.calculateStatistics();

    // Print final summary
    logger.info(
      {
        totalRequests: results.totalRequests,
        successful: results.successfulRequests,
        failed: results.failedRequests,
        avgResponseTime: results.responseTimes.avg,
        p95ResponseTime: results.responseTimes.p95,
        p99ResponseTime: results.responseTimes.p99,
      },
      'Stress test completed'
    );

    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `scripts/stress-test-results-${timestamp}.json`;
    writeFileSync(filename, JSON.stringify(results, null, 2));

    logger.info({ filename }, 'Results saved to file');

    return results;
  }
}

// Run the stress test
async function main() {
  const test = new StressTest();

  try {
    await test.run();
    process.exit(0);
  } catch (error) {
    logger.error({ error: (error as Error).message }, 'Stress test failed');
    process.exit(1);
  }
}

main();
