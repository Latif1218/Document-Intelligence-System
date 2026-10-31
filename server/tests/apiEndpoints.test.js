import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/server.js';
import config from '../src/shared/config/index.js';

describe('API Endpoints & Security Test Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    return new Promise((resolve) => {
      // Start temporary test server on an ephemeral port
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    return new Promise((resolve) => {
      if (server) {
        server.close(resolve);
      } else {
        resolve();
      }
    });
  });

  it('GET /health should return 200 without requiring API key', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'UP');
  });

  it('GET /documents without API key should return 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/documents`);
    const body = await res.json();

    assert.equal(res.status, 401);
    assert.equal(body.success, false);
    assert.match(body.message, /Unauthorized/i);
  });

  it('GET /documents with invalid API key should return 403 Forbidden', async () => {
    const res = await fetch(`${baseUrl}/documents`, {
      headers: {
        'x-api-key': 'incorrect_dummy_key_123',
      },
    });
    const body = await res.json();

    assert.equal(res.status, 403);
    assert.equal(body.success, false);
    assert.match(body.message, /Forbidden/i);
  });

  it('GET /documents/:id/status with non-UUID should fail Zod validation with 400', async () => {
    const res = await fetch(`${baseUrl}/documents/not-a-valid-uuid/status`, {
      headers: {
        'x-api-key': config.app.apiKey,
      },
    });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Validation Error');
    assert.ok(body.errors.some((e) => e.field.includes('id')));
  });

  it('GET /search with empty query should return 400 Validation Error', async () => {
    const res = await fetch(`${baseUrl}/search?q=`, {
      headers: {
        'x-api-key': config.app.apiKey,
      },
    });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, 'Validation Error');
  });

  it('GET /unknown-route should return 404 Route Not Found', async () => {
    const res = await fetch(`${baseUrl}/non-existent-endpoint`);
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.success, false);
  });
});

