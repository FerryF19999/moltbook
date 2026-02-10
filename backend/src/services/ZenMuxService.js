/**
 * ZenMux LLM Proxy Service
 * Routes LLM requests to the correct provider and handles errors/retries
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { resolveProvider } = require('../config/zenmux');

// Simple in-memory rate limiter per user
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // requests per window

class ZenMuxService {
  /**
   * Check rate limit for a user
   */
  static checkRateLimit(userId) {
    const now = Date.now();
    let entry = rateLimitMap.get(userId);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
      entry = { windowStart: now, count: 0 };
      rateLimitMap.set(userId, entry);
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
      throw Object.assign(new Error('Rate limit exceeded. Max 20 requests per minute.'), { status: 429 });
    }
  }

  /**
   * Send a chat completion request through ZenMux
   */
  static async chatCompletion({ model, messages, temperature, max_tokens, stream = false }) {
    const provider = resolveProvider(model);

    if (!provider.apiKey) {
      throw Object.assign(
        new Error(`No API key configured for provider: ${provider.name || 'unknown'}`),
        { status: 503 }
      );
    }

    const isAnthropic = (provider.id || provider.name || '').toLowerCase().includes('anthropic');

    // Build request based on provider type
    let url, headers, body;

    if (isAnthropic) {
      url = `${provider.baseUrl}/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': provider.apiKey,
        'anthropic-version': '2023-06-01',
      };
      body = JSON.stringify({
        model,
        messages,
        max_tokens: max_tokens || 1024,
        ...(temperature != null && { temperature }),
      });
    } else {
      // OpenAI-compatible (OpenAI, Groq, proxy)
      url = `${provider.baseUrl}/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      };
      body = JSON.stringify({
        model,
        messages,
        ...(temperature != null && { temperature }),
        ...(max_tokens && { max_tokens }),
        stream,
      });
    }

    const result = await ZenMuxService._fetch(url, { method: 'POST', headers, body });
    return {
      ...result,
      _provider: provider.name || provider.id,
      _model: model,
    };
  }

  /**
   * List available models
   */
  static listModels() {
    const { PROVIDERS } = require('../config/zenmux');
    const models = [];
    for (const [id, p] of Object.entries(PROVIDERS)) {
      for (const m of p.models) {
        models.push({ id: m, provider: id, available: !!p.apiKey });
      }
    }
    return models;
  }

  /**
   * Simple HTTP fetch (no external deps needed)
   */
  static _fetch(url, { method, headers, body }) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(parsed, { method, headers }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 400) {
              const err = new Error(json.error?.message || `Provider returned ${res.statusCode}`);
              err.status = res.statusCode >= 500 ? 502 : res.statusCode;
              err.providerError = json;
              return reject(err);
            }
            resolve(json);
          } catch {
            if (res.statusCode >= 400) {
              const err = new Error(`Provider error: ${res.statusCode}`);
              err.status = 502;
              return reject(err);
            }
            resolve({ raw: data });
          }
        });
      });
      req.on('error', (err) => {
        err.status = 502;
        reject(err);
      });
      req.setTimeout(30000, () => {
        req.destroy();
        const err = new Error('Provider request timed out');
        err.status = 504;
        reject(err);
      });
      if (body) req.write(body);
      req.end();
    });
  }
}

module.exports = ZenMuxService;
