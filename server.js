import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { askModel, validatePractice } from './model.js';

const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ...['app', 'voice', 'lessons', 'reports'].map(name => ['/'+name+'.js', [name+'.js', 'text/javascript']])
]);

export function createApp(env = process.env) {
  const key = env.MODEL_API_KEY?.trim();
  const url = new URL((env.MODEL_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '') + '/chat/completions');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) {
    throw new Error('MODEL_BASE_URL must use HTTPS outside localhost.');
  }
  const config = { url, key, model: env.MODEL_NAME || 'gpt-4.1-mini' };
  let windowStart = 0;
  let requests = 0;
  let inFlight = 0;
  return createServer({ requestTimeout: 15000 }, async (req, res) => {
    const path = req.url;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    function json(status, body) {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    }
    if (req.method === 'GET' && files.has(path)) {
      const [name, type] = files.get(path);
      try {
        const contents = await readFile(new URL('public/' + name, import.meta.url));
        res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
        res.end(contents);
      } catch { json(500, { error: '页面暂不可用。' }); }
      return;
    }
    if (req.method === 'GET' && path === '/api/config') return json(200, { enabled: Boolean(key) });
    if (req.method !== 'POST' || !['/api/chat', '/api/report'].includes(path)) {
      return json(404, { error: '页面或接口不存在。' });
    }
    const origin = req.headers.origin;
    if ((origin && origin !== 'http://' + req.headers.host && origin !== 'https://' + req.headers.host) ||
        req.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: '仅接受同源请求。' });
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
      return json(415, { error: '需要 JSON 请求。' });
    }
    if (!key) return json(503, { error: '服务器尚未配置 AI 模型。' });
    if (Date.now() - windowStart >= 60000) {
      windowStart = Date.now();
      requests = 0;
    }
    if (requests >= 30 || inFlight >= 4) return json(429, { error: '请求繁忙，请稍后重试。' });
    requests++;
    inFlight++;
    const connection = new AbortController();
    res.on('close', () => connection.abort());
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > 256 * 1024) {
          res.setHeader('Connection', 'close');
          return json(413, { error: '对话长度超过本次处理上限。' });
        }
        chunks.push(chunk);
      }
      let practice;
      try { practice = validatePractice(JSON.parse(Buffer.concat(chunks))); }
      catch { return json(400, { error: '课程或对话格式无效。' }); }
      const report = path === '/api/report';
      if (report && !practice.history.some(turn => turn.role === 'user')) {
        return json(400, { error: '至少需要一条学习者发言。' });
      }
      json(200, await askModel(config, report ? 'report' : 'chat', practice, connection.signal));
    } catch {
      json(502, { error: '模型暂时无法生成有效回复，请重试。' });
    } finally {
      inFlight--;
    }
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, host, () => console.log(`Parlons listening on ${host}:${port}`));
}
