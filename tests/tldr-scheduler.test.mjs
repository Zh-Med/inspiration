import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureTldr } from '../scripts/tldr-scheduler.mjs';

const now = Date.parse('2026-11-24T00:09:00Z');
const response = value => Response.json(value);

test('a ready edition for today requires no GitHub credential or request', async () => {
  const result = await ensureTldr({ now, request: async url => {
    assert.equal(url.hostname, 'zh-med.github.io');
    return response({ tldrDate: '2026-11-24', tldrStatus: 'ready' });
  } });
  assert.equal(result, 'published');
});

test('an incomplete edition waits for a recent queued or running job', async () => {
  const result = await ensureTldr({ now, token: 'fake', request: async (url, options) => {
    if (url instanceof URL) return response({ tldrDate: '2026-11-24', tldrStatus: 'partial' });
    assert.ok(url.includes('/runs?branch=main'));
    assert.equal(options.headers.Authorization, 'Bearer fake');
    return response({ workflow_runs: [{ status: 'queued', created_at: '2026-11-24T00:03:00Z' }] });
  } });
  assert.equal(result, 'publishing');
});

test('missing edition and no recent live run dispatches the existing Pages workflow', async () => {
  let dispatches = 0;
  const result = await ensureTldr({ now, token: 'fake', request: async (url, options) => {
    if (url instanceof URL) return response({ tldrDate: '2026-11-23', tldrStatus: 'ready' });
    if (url.includes('/runs?')) return response({ workflow_runs: [
      { status: 'completed', created_at: '2026-11-24T00:06:00Z' },
      { status: 'in_progress', created_at: '2026-11-23T23:50:00Z' },
    ] });
    assert.match(url, /pages\.yml\/dispatches$/);
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { ref: 'main' });
    dispatches++;
    return new Response(null, { status: 204 });
  } });
  assert.equal(result, 'dispatched');
  assert.equal(dispatches, 1);
});
