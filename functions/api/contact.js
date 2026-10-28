import { json, readJson, cleanText, isEmail, visitorHash, sendEmail } from '../../lib/shared.js';

const MAX_MESSAGES_PER_HOUR = 5;

// POST /api/contact { name, email, subject, message, consent, website }
export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'not_configured' }, 503);

  const body = await readJson(request);
  if (!body) return json({ error: 'invalid_body' }, 400);

  // Honeypot: real visitors never see or fill the "website" field.
  if (cleanText(body.website, 200)) return json({ ok: true });

  const name = cleanText(body.name, 100);
  const email = cleanText(body.email, 200).toLowerCase();
  const subject = cleanText(body.subject, 200);
  const message = cleanText(body.message, 5000);

  if (!name || !subject || !message || !isEmail(email) || body.consent !== true) {
    return json({ error: 'invalid_fields' }, 400);
  }

  const visitor = await visitorHash(request, env);
  const recent = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM contact_messages WHERE visitor = ? AND created_at > datetime('now', '-1 hour')")
    .bind(visitor)
    .first();
  if (recent && recent.n >= MAX_MESSAGES_PER_HOUR) return json({ error: 'rate_limited' }, 429);

  const saved = await env.DB
    .prepare('INSERT INTO contact_messages (name, email, subject, message, visitor) VALUES (?, ?, ?, ?, ?)')
    .bind(name, email, subject, message, visitor)
    .run();
  const messageId = saved.meta.last_row_id;

  const ownerNotified = await sendEmail(env, {
    to: env.OWNER_EMAIL,
    replyTo: email,
    subject: 'New message from ' + name + ': ' + subject,
    text: [
      'New message from the website contact form.',
      '',
      'Name: ' + name,
      'Email: ' + email,
      'Subject: ' + subject,
      '',
      message,
      '',
      'Reply to this email to answer ' + name + ' directly.'
    ].join('\n')
  });

  // Confirmations go to arbitrary addresses, which Resend only allows from a verified domain.
  const confirmationSent = env.SEND_CONFIRMATION === 'true'
    ? await sendEmail(env, {
        to: email,
        replyTo: env.OWNER_EMAIL,
        subject: 'Thanks for your message, ' + name,
        text: [
          'Hi ' + name + ',',
          '',
          'thanks for reaching out. I received your message and will get back to you soon.',
          '',
          'Your message:',
          '"' + subject + '"',
          message,
          '',
          'Aroul Da Vinci'
        ].join('\n')
      })
    : false;

  await env.DB
    .prepare('UPDATE contact_messages SET owner_notified = ?, confirmation_sent = ? WHERE id = ?')
    .bind(ownerNotified ? 1 : 0, confirmationSent ? 1 : 0, messageId)
    .run();

  return json({ ok: true, confirmationSent });
}
