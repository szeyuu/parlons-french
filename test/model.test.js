import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createApp } from '../server.js';
import { lessons } from '../public/lessons.js';

async function listen(t, server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  return 'http://127.0.0.1:' + server.address().port;
}

const history = [
  { role: 'assistant', content: 'Bonjour !' },
  { role: 'user', content: 'Je suis allé au cafés.' },
  { role: 'assistant', content: 'Que voulez-vous boire ?' }
];
const payload = { level: 'A2', lessonIndex: 0, history };
const post = (base, path, body = payload, headers = {}) => fetch(base + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body)
});

test('all 21 lessons retain vocabulary, examples and questions', () => {
  assert.deepEqual(Object.values(lessons).map(group => group.length), [9, 4, 4, 4]);
  assert.equal(lessons.A2[0].title, 'Au café du quartier');
  for (const lesson of Object.values(lessons).flat()) {
    for (const key of ['vocab', 'examples', 'questions']) assert.ok(lesson[key].length >= 2);
  }
});

test('demo serves the site without a model key', async t => {
  const base = await listen(t, createApp({}));
  assert.match(await (await fetch(base)).text(), /Parlons/);
  assert.equal((await fetch(base + '/app.js')).status, 200);
  assert.deepEqual(await (await fetch(base + '/api/config')).json(), { enabled: false });
  assert.equal((await post(base, '/api/chat')).status, 503);
  assert.equal((await fetch(base + '/.env')).status, 404);
});

test('proxy sends the full transcript and filters corrections to exact learner turns', async t => {
  const calls = [];
  const quote = (original, reason = 'au 指单数，应使用 café。') =>
    ({ category: 'grammar', original, corrected: 'Je suis allé au café.', reason });
  const report = {
    summary: '练习了咖啡馆用语。',
    dimensions: { grammar: { observation: '冠词和名词需一致。' } },
    corrections: [quote(history[1].content), quote(history[0].content), quote('Je vais au cafés.'), quote(history[1].content, '')],
    pronunciationScore: 90
  };
  const upstream = await listen(t, createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    calls.push({ path: req.url, auth: req.headers.authorization, body: JSON.parse(Buffer.concat(chunks)) });
    const content = calls.length === 1 ? 'Un café ?' : JSON.stringify(report);
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  }));
  const base = await listen(t, createApp({ MODEL_API_KEY: 'test-only-token', MODEL_BASE_URL: upstream + '/v1', MODEL_NAME: 'mock' }));
  assert.equal((await post(base, '/api/chat', payload, { Origin: 'https://elsewhere.example' })).status, 403);
  assert.equal((await post(base, '/api/chat', { ...payload, level: 'C2' })).status, 400);
  assert.equal((await post(base, '/api/report', { ...payload, history: [] })).status, 400);
  assert.deepEqual(await (await post(base, '/api/chat')).json(), { content: 'Un café ?' });
  const result = await (await post(base, '/api/report')).json();
  assert.equal(calls[0].path, '/v1/chat/completions');
  assert.equal(calls[0].auth, 'Bearer test-only-token');
  assert.equal(calls[0].body.model, 'mock');
  assert.deepEqual(calls[0].body.messages.slice(1), history);
  assert.deepEqual(JSON.parse(calls[1].body.messages[1].content), history);
  assert.equal(Object.keys(result.dimensions).length, 6);
  assert.deepEqual(result.corrections, [quote(history[1].content)]);
  assert.equal(result.pronunciationScore, undefined);
});
