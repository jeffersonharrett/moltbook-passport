// index.js - Moltbook Passport Verifier using Hono
import { Hono } from 'hono';
import { env } from 'hono/adapter';          // Used to safely read environment variables
import axios from 'axios';

const app = new Hono();

// Read your App Key from environment variables (set this in Vercel project settings)
const MOLTBOOK_APP_KEY = env('MOLTBOOK_APP_KEY', process.env.MOLTBOOK_APP_KEY);

// Temporary fallback for testing when you don't have the real key yet
const USE_MOCK = !MOLTBOOK_APP_KEY || MOLTBOOK_APP_KEY.trim() === '';

// Health check route (shown when accessing the root path)
app.get('/', (c) => {
  if (USE_MOCK) {
    return c.text(
      'Moltbook Passport service is running (MOCK MODE - no real key set yet). ' +
      'POST /verify with any token to get mock agent data.'
    );
  }
  return c.text('Moltbook Passport service is running. POST /verify { "token": "..." } to verify agent identity.');
});

// Core endpoint: Verify identity
app.post('/verify', async (c) => {
  let body;
  try {
    body = await c.req.json();          // Hono has built-in JSON body parsing
  } catch (e) {
    return c.json({ success: false, error: 'Invalid JSON format' }, 400);
  }

  const { token } = body;

  if (!token) {
    return c.json({ success: false, error: 'Missing token' }, 400);
  }

  // Temporary mock mode when no real key is available
  if (USE_MOCK) {
    console.log('[MOCK] Verifying token (fake success)');

    return c.json({
      success: true,
      agent: {
        id: 'mock-agent-123',
        name: 'TestAgent007',
        karma: 888,
        posts: 42,
        comments: 156,
        owner_x_handle: '@testuser_mock',
        is_claimed: true,
      },
      message: 'MOCK VERIFICATION SUCCESS (real key pending approval). ' +
               'Your fake karma is 888. You would be granted access!'
    });
  }

  // Real verification (only runs when MOLTBOOK_APP_KEY is set)
  try {
    const response = await axios.post(
      'https://www.moltbook.com/api/v1/agents/verify-identity',
      { token },
      {
        headers: {
          'X-Moltbook-App-Key': MOLTBOOK_APP_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = response.data;

    if (data.success && data.valid) {
      return c.json({
        success: true,
        agent: {
          id: data.agent.id,
          name: data.agent.name,
          karma: data.agent.karma,
          posts: data.agent.stats?.posts || 0,
          comments: data.agent.stats?.comments || 0,
          owner_x_handle: data.agent.owner?.x_handle || 'Unknown',
          is_claimed: data.agent.is_claimed,
        },
        message: `Welcome, ${data.agent.name}! Your karma is ${data.agent.karma}.`
      });
    } else {
      return c.json({ success: false, error: 'Token is invalid or expired' }, 401);
    }
  } catch (error) {
    console.error('Verification failed:', error.response?.data || error.message);
    return c.json(
      {
        success: false,
        error: 'Server error, please try again later or check the token'
      },
      500
    );
  }
});

// Global error handler (recommended)
app.onError((err, c) => {
  console.error('Global error:', err);
  return c.json({ success: false, error: 'Internal server error' }, 500);
});

export default app;

