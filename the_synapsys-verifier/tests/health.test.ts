/**
 * Health Endpoint Tests
 *
 * Basic test suite to verify the health check endpoint functionality.
 * This ensures the service is properly responding to health checks.
 */

import request from 'supertest';
import app from '../src/index';

describe('Health Endpoint', () => {
  describe('GET /health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service', 'the-synapsys-verifier');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return valid timestamp format', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);

      const timestamp = response.body.timestamp as string;
      const isValidDate = !isNaN(Date.parse(timestamp));
      expect(isValidDate).toBe(true);
    });

    it('should return positive uptime', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
