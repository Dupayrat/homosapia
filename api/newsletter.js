const RESEND_KEY  = process.env.RESEND_API_KEY;
const NOTIFY      = process.env.NOTIFY_EMAIL || 'contact@homosapia.com';
const FROM        = 'Homo SapIA <contact@homosapia.com>';

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://homosapia.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }

  try {
    // Welcome email to subscriber
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: email,
        subject: 'Bienvenue dans les insights Homo SapIA 🎯',
        html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1a1a2e;">
          <h2 style="font-size:22px;margin-bottom:16px;">Bienvenue !</h2>
          <p style="font-size:15px;line-height:1.7;color:#555;">
            Merci de votre inscription. Chaque mois, vous recevrez nos insights sur l'IA en entreprise :
            tendances, cas d'usage concrets et outils testés sur le terrain.
          </p>
          <p style="font-size:15px;line-height:1.7;color:#555;">
            En attendant, vous pouvez réaliser votre
            <a href="https://homosapia.com/diagnostic.html" style="color:#F26B3A;text-decoration:none;font-weight:600;">diagnostic IA gratuit</a>
            pour évaluer votre maturité en 5 minutes.
          </p>
          <p style="font-size:15px;line-height:1.7;color:#555;margin-top:24px;">
            À très vite,<br>
            <strong>Philippe du Payrat</strong><br>
            <span style="color:#888;font-size:13px;">Fondateur · Homo SapIA</span>
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;">
          <p style="font-size:11px;color:#999;text-align:center;">
            Homo SapIA · Tempo Libre · <a href="https://homosapia.com" style="color:#999;">homosapia.com</a>
          </p>
        </div>`
      })
    });

    // Notify Philippe
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: NOTIFY,
        subject: `📬 Nouvel inscrit newsletter : ${email}`,
        html: `<p>Nouvel abonné newsletter : <strong>${email}</strong></p><p>Date : ${new Date().toLocaleString('fr-FR', {timeZone:'Europe/Paris'})}</p>`
      })
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Newsletter error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}
