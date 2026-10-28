// Adds HTTP Range support to MP3s. Cloudflare Pages serves static files without it,
// which stops browsers from jumping to an unbuffered part of a song.

function byteSlice(start, endExclusive) {
  let position = 0;
  return new TransformStream({
    transform(chunk, controller) {
      const chunkStart = position;
      position += chunk.byteLength;
      if (position > start && chunkStart < endExclusive) {
        controller.enqueue(chunk.subarray(Math.max(0, start - chunkStart), Math.min(chunk.byteLength, endExclusive - chunkStart)));
      }
      if (position >= endExclusive) controller.terminate();
    }
  });
}

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec((header || '').trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  return { start, end };
}

async function serveAudio({ request, env, next }, includeBody) {
  const url = new URL(request.url);
  if (!url.pathname.toLowerCase().endsWith('.mp3')) return next();

  let asset = await env.ASSETS.fetch(new Request(url.toString()));
  const contentType = asset.headers.get('content-type') || '';
  // Missing files fall back to the HTML page; pass those (and errors) through untouched.
  if (!asset.ok || !asset.body || contentType.includes('text/html')) return asset;

  let size = Number(asset.headers.get('content-length'));
  if (!size) {
    // No length header (chunked response): buffer the file once to learn its size.
    const buffer = await asset.arrayBuffer();
    size = buffer.byteLength;
    asset = new Response(buffer, { status: asset.status, headers: asset.headers });
  }
  if (!size) return asset;

  const headers = new Headers(asset.headers);
  headers.set('accept-ranges', 'bytes');
  headers.set('content-type', 'audio/mpeg');

  const range = request.headers.get('range') ? parseRange(request.headers.get('range'), size) : null;
  if (!range) {
    headers.set('content-length', String(size));
    return new Response(includeBody ? asset.body : null, { status: 200, headers });
  }

  if (range.start >= size || range.start > range.end) {
    asset.body.cancel();
    headers.set('content-range', 'bytes */' + size);
    headers.delete('content-length');
    return new Response(null, { status: 416, headers });
  }

  const length = range.end - range.start + 1;
  headers.set('content-range', 'bytes ' + range.start + '-' + range.end + '/' + size);
  headers.set('content-length', String(length));

  if (!includeBody) {
    asset.body.cancel();
    return new Response(null, { status: 206, headers });
  }

  let body = asset.body.pipeThrough(byteSlice(range.start, range.end + 1));
  if (typeof FixedLengthStream !== 'undefined') body = body.pipeThrough(new FixedLengthStream(length));
  return new Response(body, { status: 206, headers });
}

export function onRequestGet(context) {
  return serveAudio(context, true);
}

export function onRequestHead(context) {
  return serveAudio(context, false);
}
