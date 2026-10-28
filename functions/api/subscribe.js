import { json, readJson, cleanText, isEmail } from '../../lib/shared.js';

// POST /api/subscribe { email, consent, website }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'not_configured' }, 503);

  const body = await readJson(request);
  if (!body) return json({ error: 'invalid_body' }, 400);

  if (cleanText(body.website, 200)) return json({ ok: true });

  const email = cleanText(body.email, 200).toLowerCase();
  if (!isEmail(email) || body.consent !== true) return json({ error: 'invalid_fields' }, 400);

  const result = await env.DB
    .prepare('INSERT OR IGNORE INTO subscribers (email, source) VALUES (?, ?)')
    .bind(email, 'website')
    .run();

  return json({ ok: true, alreadySubscribed: result.meta.changes === 0 });
}
