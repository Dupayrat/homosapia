// Vercel Serverless Function — receives contact form data, sends emails via Resend
// POST /api/contact

function esc(str) {
  if (!str || typeof str !== 'string') return str || '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://homosapia.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }

    const safeName = esc(name);
    const safeEmail = esc(email);
    const safeMessage = esc(message);

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'philippe@homosapia.com';

    let emailStatus = { notification: 'skipped', confirmation: 'skipped' };

    if (RESEND_API_KEY) {
      // 1. Send notification to Philippe
      try {
        const notifResult = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Homo SapIA <contact@homosapia.com>',
            to: [NOTIFY_EMAIL],
            subject: `📩 Nouveau message de ${safeName}`,
            html: `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0A0F; color: #E8E6E1; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #12121A; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #1a1a2e, #12121A); padding: 28px 32px; border-bottom: 1px solid rgba(255,255,255,0.06);">
      <h1 style="margin: 0; font-size: 20px; color: #F26B3A;">📩 Nouveau message</h1>
      <p style="margin: 8px 0 0; color: #8A8A95; font-size: 14px;">Via le formulaire de contact homosapia.com</p>
    </div>
    <div style="padding: 28px 32px;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #8A8A95;">Nom</p>
      <p style="margin: 0 0 20px; font-size: 16px;">${safeName}</p>
      <p style="margin: 0 0 8px; font-size: 14px; color: #8A8A95;">Email</p>
      <p style="margin: 0 0 20px; font-size: 16px;"><a href="mailto:${safeEmail}" style="color: #F26B3A;">${safeEmail}</a></p>
      <p style="margin: 0 0 8px; font-size: 14px; color: #8A8A95;">Message</p>
      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${safeMessage}</div>
    </div>
    <div style="text-align: center; padding: 20px 32px 28px;">
      <a href="mailto:${safeEmail}?subject=${encodeURIComponent(`Re: Votre message sur Homo SapIA`)}" style="display: inline-block; background: #F26B3A; color: white; padding: 12px 28px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 14px;">Répondre à ${safeName} →</a>
    </div>
  </div>
</body></html>`
          })
        });
        emailStatus.notification = notifResult.ok ? 'sent' : 'error';
        if (!notifResult.ok) console.error('Contact notification error:', await notifResult.text());
      } catch (err) {
        emailStatus.notification = 'error';
        console.error('Contact notification failed:', err.message);
      }

      // 2. Send confirmation to visitor
      try {
        const confResult = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Philippe du Payrat <contact@homosapia.com>',
            to: [email],
            subject: `Merci pour votre message, ${safeName}`,
            html: `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0A0F; color: #E8E6E1; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #12121A; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden;">
    <div style="background: linear-gradient(135deg, #1a1a2e, #12121A); padding: 28px 32px; border-bottom: 1px solid rgba(255,255,255,0.06);">
      <h1 style="margin: 0; font-size: 20px; color: #E8E6E1;">Homo Sap<span style="color: #F26B3A;">IA</span></h1>
    </div>
    <div style="padding: 28px 32px; line-height: 1.7; font-size: 15px;">
      <p>Bonjour ${safeName},</p>
      <p>Merci pour votre message. Je l'ai bien reçu et je reviens vers vous rapidement, en général sous 24 heures.</p>
      <p>Si votre demande est urgente, vous pouvez directement réserver un créneau d'échange :</p>
    </div>
    <div style="text-align: center; padding: 0 32px 28px;">
      <a href="https://meetings-eu1.hubspot.com/pdu-payrat?uuid=5a24cb40-61aa-41f5-aee3-8cc6a8cae0bf" style="display: inline-block; background: #F26B3A; color: white; padding: 13px 28px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 14px;">Réserver un créneau →</a>
    </div>
    <div style="padding: 20px 32px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 13px; color: #8A8A95;">
      <p style="margin: 0;">Philippe du Payrat<br>Fondateur · Homo SapIA<br>
      <a href="https://homosapia.com" style="color: #F26B3A;">homosapia.com</a></p>
    </div>
  </div>
</body></html>`
          })
        });
        emailStatus.confirmation = confResult.ok ? 'sent' : 'error';
        if (!confResult.ok) console.error('Contact confirmation error:', await confResult.text());
      } catch (err) {
        emailStatus.confirmation = 'error';
        console.error('Contact confirmation failed:', err.message);
      }
    }

    return res.status(200).json({ success: true, emailStatus });

  } catch (error) {
    console.error('Contact API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
