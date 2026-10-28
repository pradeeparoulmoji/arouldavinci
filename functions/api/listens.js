import { json, readJson, today, visitorHash, getTrackIds } from '../../lib/shared.js';

// GET /api/listens -> { counts: { [trackId]: number } }
export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: 'not_configured' }, 503);
  const { results } = await env.DB.prepare('SELECT track_id, count FROM listen_counts').all();
  const counts = {};
  for (const row of results) counts[row.track_id] = row.count;
  return new Response(JSON.stringify({ counts }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60'
    }
  });
}

// POST /api/listens { id } -> counts one listen per visitor, beat and day.
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'not_configured' }, 503);

  const body = await readJson(request);
  const id = body && typeof body.id === 'string' ? body.id : '';
  if (!/^[a-z0-9_-]{1,64}$/i.test(id)) return json({ error: 'invalid_id' }, 400);

  const trackIds = await getTrackIds(request, env);
  if (!trackIds.has(id)) return json({ error: 'unknown_track' }, 404);

  const day = today();
  const visitor = await visitorHash(request, env);
  const inserted = await env.DB
    .prepare('INSERT OR IGNORE INTO listen_events (track_id, day, visitor) VALUES (?, ?, ?)')
    .bind(id, day, visitor)
    .run();
  const counted = inserted.meta.changes > 0;

  if (counted) {
    await env.DB
      .prepare('INSERT INTO listen_counts (track_id, count) VALUES (?, 1) ON CONFLICT(track_id) DO UPDATE SET count = count + 1')
      .bind(id)
      .run();
    // Occasionally drop dedupe rows older than yesterday; they are only needed for one day.
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
      await env.DB.prepare('DELETE FROM listen_events WHERE day < ?').bind(cutoff).run();
    }
  }

  const row = await env.DB.prepare('SELECT count FROM listen_counts WHERE track_id = ?').bind(id).first();
  return json({ ok: true, counted, count: row ? row.count : 0 });
}
