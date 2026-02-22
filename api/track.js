// Vercel Serverless Function — tracks clicks on Gamma presentation links
// GET /api/track?id=GENERATION_ID&email=EMAIL&name=NAME
// Logs the click, sends a notification to Philippe, then redirects to Gamma

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { id, email, name } = req.query;
  if (!id) return res.redirect(302, 'https://homosapia.com');

  const gammaUrl = `https://gamma.app/generations/${id}`;
  const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  // Log the click (visible in Vercel logs)
  console.log(`📊 GAMMA CLICK | ${name || 'Unknown'} <${email || 'N/A'}> | ${timestamp} | ${gammaUrl}`);

  // Send notification email to Philippe (fire-and-forget)
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'philippe@homosapia.com';

  if (RESEND_API_KEY && email) {
    try {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Homo SapIA Bot <diagnostic@homosapia.com>',
          to: [NOTIFY_EMAIL],
          subject: `📊 ${name || email} a consulté sa présentation Gamma`,
          html: `<div style="font-family:sans-serif;max-width:500px;padding:20px;">
            <h2 style="margin:0 0 12px;">📊 Clic sur la présentation Gamma</h2>
            <p><strong>Qui :</strong> ${name || 'N/A'} &lt;${email}&gt;</p>
            <p><strong>Quand :</strong> ${timestamp}</p>
            <p><strong>Lien :</strong> <a href="${gammaUrl}">${gammaUrl}</a></p>
            <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
            <p style="color:#888;font-size:12px;">Ce prospect montre de l'intérêt — c'est le bon moment pour le relancer.</p>
          </div>`
        })
      }).catch(() => {}); // fire-and-forget
    } catch (e) {
      // Silent fail
    }
  }

  // Redirect to Gamma presentation
  return res.redirect(302, gammaUrl);
}
