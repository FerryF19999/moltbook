/**
 * Credit System & ZenMux Integration Tests
 * 
 * Run: node test/credits.test.js
 * Requires: DATABASE_URL set, migration run
 */

const http = require('http');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
let TOKEN = null;
const TEST_EMAIL = `test_${Date.now()}@moltbook.test`;
const TEST_PASS = 'testpass123';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (TOKEN) options.headers['Authorization'] = `Bearer ${TOKEN}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function run() {
  console.log('\\n🧪 Credit System Tests\\n');

  await test('Register user', async () => {
    const res = await request('POST', '/api/v1/auth/register', {
      email: TEST_EMAIL, password: TEST_PASS, name: 'Test User'
    });
    assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.data.token, 'No token returned');
    TOKEN = res.body.data.token;
  });

  await test('Login user', async () => {
    const res = await request('POST', '/api/v1/auth/login', {
      email: TEST_EMAIL, password: TEST_PASS
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.token, 'No token');
    TOKEN = res.body.data.token;
  });

  await test('Get credit balance (should be 100)', async () => {
    const res = await request('GET', '/api/v1/credits/balance');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.balance === 100, `Expected 100, got ${res.body.data.balance}`);
  });

  await test('Deduct credits (gpt-4o = 5 credits)', async () => {
    const res = await request('POST', '/api/v1/credits/deduct', { model: 'gpt-4o' });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.cost === 5, `Expected cost 5, got ${res.body.data.cost}`);
    assert(res.body.data.balance === 95, `Expected balance 95, got ${res.body.data.balance}`);
  });

  await test('Get balance after deduction (should be 95)', async () => {
    const res = await request('GET', '/api/v1/credits/balance');
    assert(res.body.data.balance === 95, `Expected 95, got ${res.body.data.balance}`);
  });

  await test('Top up credits (+50)', async () => {
    const res = await request('POST', '/api/v1/credits/topup', { amount: 50 });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.balance === 145, `Expected 145, got ${res.body.data.balance}`);
  });

  await test('Get transaction history', async () => {
    const res = await request('GET', '/api/v1/credits/transactions');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.data.length >= 2, `Expected >=2 transactions, got ${res.body.data.length}`);
  });

  await test('List LLM models', async () => {
    const res = await request('GET', '/api/v1/llm/models');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.body.data), 'Expected array');
  });

  await test('Unauthorized access (no token)', async () => {
    const oldToken = TOKEN;
    TOKEN = null;
    const res = await request('GET', '/api/v1/credits/balance');
    assert(res.status === 401, `Expected 401, got ${res.status}`);
    TOKEN = oldToken;
  });

  await test('Duplicate registration', async () => {
    const res = await request('POST', '/api/v1/auth/register', {
      email: TEST_EMAIL, password: TEST_PASS
    });
    assert(res.status === 409, `Expected 409, got ${res.status}`);
  });

  console.log('\\n✅ All tests complete\\n');
}

run().catch(console.error);
