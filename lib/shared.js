// Helpers shared by the Pages Functions in /functions.

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

export function cleanText(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength);
}

export function isEmail(value) {
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(value) && value.length <= 200;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// Salted daily hash of IP + browser: identifies a repeat visitor for one day without storing the IP.
export async function visitorHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const agent = request.headers.get('User-Agent') || '';
  const salt = env.HASH_SALT || 'aroul-da-vinci';
  const data = new TextEncoder().encode(ip + '|' + agent + '|' + today() + '|' + salt);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

let trackIdCache = null;
let trackIdCacheTime = 0;

// Valid beat ids are the folder names listed in music/beats.json.
export async function getTrackIds(request, env) {
  if (trackIdCache && Date.now() - trackIdCacheTime < 5 * 60 * 1000) return trackIdCache;
  const response = await env.ASSETS.fetch(new URL('/music/beats.json', request.url));
  if (!response.ok) throw new Error('beats.json not available');
  const beats = await response.json();
  trackIdCache = new Set(beats.map((beat) => String(beat.folder || '').replace(/^\/+|\/+$/g, '')).filter(Boolean));
  trackIdCacheTime = Date.now();
  return trackIdCache;
}

// Sends an email through Resend (https://resend.com). Returns false when not configured or on failure.
export async function sendEmail(env, { to, subject, text, replyTo }) {
  if (!env.RESEND_API_KEY || !to) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + env.RESEND_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: env.MAIL_FROM || 'Aroul Da Vinci <onboarding@resend.dev>',
        to: [to],
        subject,
        text,
        reply_to: replyTo || undefined
      })
    });
    if (!response.ok) console.error('Resend error', response.status, await response.text());
    return response.ok;
  } catch (e) {
    console.error('Resend request failed', e);
    return false;
  }
}
