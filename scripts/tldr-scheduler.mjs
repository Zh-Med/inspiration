// Separate Cloudflare Worker. Bind the GitHub credential only on this Worker.
const pages = 'https://zh-med.github.io/inspiration/build-info.json';
const workflow = 'https://api.github.com/repos/Zh-Med/inspiration/actions/workflows/pages.yml';
const gracePeriod = 15 * 60 * 1000;

export async function ensureTldr({ now, token, request = fetch }) {
  const date = new Date(now).toISOString().slice(0, 10);
  const reportUrl = new URL(pages);
  reportUrl.searchParams.set('check', String(now));
  try {
    const published = await request(reportUrl, { signal: AbortSignal.timeout(5000) });
    if (published.ok) {
      const report = await published.json();
      if (report.tldrDate === date && report.tldrStatus === 'ready') return 'published';
    }
  } catch {
    // An unavailable Pages response is also a reason to check the publish queue.
  }

  if (!token) throw Error('GITHUB_DISPATCH_TOKEN is missing');
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2026-03-10',
  };
  const options = () => ({ headers, signal: AbortSignal.timeout(8000), redirect: 'error' });
  const runs = await request(workflow + '/runs?branch=main&per_page=20', options());
  if (!runs.ok) throw Error(`GitHub workflow lookup returned ${runs.status}`);
  const { workflow_runs: recent } = await runs.json();
  if (recent.some(run => run.status !== 'completed' && Date.parse(run.created_at) >= now - gracePeriod)) {
    return 'publishing';
  }

  const dispatch = await request(workflow + '/dispatches', {
    ...options(),
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main' }),
  });
  if (!dispatch.ok) throw Error(`GitHub workflow dispatch returned ${dispatch.status}`);
  return 'dispatched';
}

export default {
  async scheduled(event, env) {
    console.log(await ensureTldr({
      now: event.scheduledTime,
      token: env.GITHUB_DISPATCH_TOKEN,
    }));
  },
};
