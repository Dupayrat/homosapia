// Vercel Serverless Function — receives diagnostic data and sends notification email
// POST /api/diagnostic

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;

    // Validate required fields
    if (!data.contact || !data.contact.email || !data.scores) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { contact, company, scores, answers, level, timestamp } = data;

    // ============================================================
    // 1. Build rich notification email for Philippe
    // ============================================================
    const pillarDetails = scores.pillars.map(p => {
      const bar = '█'.repeat(Math.round(p.pct / 10)) + '░'.repeat(10 - Math.round(p.pct / 10));
      return `${p.name}: ${p.score}/${p.max} (${p.pct}%) ${bar}`;
    }).join('\n');

    const answersDetail = answers.map((a, i) =>
      `Q${i+1} [${a.pillar}]: ${a.question}\n→ ${a.answer} (${a.answerDetail}) — Score: ${a.score}/4`
    ).join('\n\n');

    // Build LinkedIn/Google search links for research
    const contactName = `${contact.firstname} ${contact.lastname}`;
    const linkedinSearchContact = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(contactName + ' ' + (company.name || ''))}`;
    const linkedinSearchCompany = company.name ? `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company.name)}` : '';
    const googleSearchCompany = company.name ? `https://www.google.com/search?q=${encodeURIComponent(company.name + ' ' + (company.sector || ''))}` : '';
    const googleNewsCompany = company.name ? `https://www.google.com/search?q=${encodeURIComponent(company.name)}&tbm=nws` : '';

    // Determine weakest pillars and matching offers
    const sortedPillars = [...scores.pillars].sort((a, b) => a.score - b.score);
    const weakest3 = sortedPillars.slice(0, 3);

    const offerMap = {
      'Shadow IA & Usages': 'Audit IA & opérationnel',
      'Souveraineté & Data': 'Accompagnement global',
      'Frugalité & Impact': 'Ateliers pratiques',
      'Éthique & Gouvernance': 'Projet pilote & déploiement',
      'Acculturation & Compétences': 'Formations IA'
    };

    const suggestedOffers = weakest3.map(p => `• ${offerMap[p.name] || 'Accompagnement global'} (faiblesse: ${p.name} à ${p.pct}%)`).join('\n');

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; background: #f8f8f8; padding: 20px;">

  <div style="background: #0A0A0F; color: #E8E6E1; border-radius: 16px; padding: 32px; margin-bottom: 20px;">
    <h1 style="margin: 0 0 4px; font-size: 24px;">🎯 Nouveau diagnostic IA</h1>
    <p style="margin: 0; color: #8A8A95; font-size: 14px;">${new Date(timestamp).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>
  </div>

  <!-- CONTACT -->
  <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #eee;">
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #333;">👤 Contact</h2>
    <table style="width: 100%; font-size: 14px; color: #333;">
      <tr><td style="padding: 4px 0; font-weight: 600; width: 120px;">Prénom</td><td>${contact.firstname}</td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Nom</td><td>${contact.lastname}</td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Email</td><td><a href="mailto:${contact.email}">${contact.email}</a></td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Téléphone</td><td>${contact.phone || '—'}</td></tr>
    </table>
  </div>

  <!-- COMPANY -->
  <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #eee;">
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #333;">🏢 Entreprise</h2>
    <table style="width: 100%; font-size: 14px; color: #333;">
      <tr><td style="padding: 4px 0; font-weight: 600; width: 120px;">Nom</td><td>${company.name || '—'}</td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Secteur</td><td>${company.sector || '—'}</td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Taille</td><td>${company.size || '—'}</td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Fonction</td><td>${company.role || '—'}</td></tr>
    </table>
  </div>

  <!-- SCORE -->
  <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #eee;">
    <h2 style="margin: 0 0 8px; font-size: 18px; color: #333;">📊 Score global</h2>
    <div style="font-size: 48px; font-weight: 700; color: ${scores.pct < 42 ? '#E85D3A' : scores.pct < 62 ? '#F2993A' : scores.pct < 82 ? '#3A8FF2' : '#4CAF50'}; text-align: center; padding: 12px 0;">
      ${scores.total} / ${scores.maxTotal} <span style="font-size: 18px; color: #888;">(${scores.pct}%)</span>
    </div>
    <p style="text-align: center; font-size: 16px; font-weight: 600; color: #555; margin: 0;">Niveau : ${level}</p>
  </div>

  <!-- PILLARS -->
  <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #eee;">
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #333;">📈 Scores par pilier</h2>
    ${scores.pillars.map(p => {
      const color = p.pct <= 33 ? '#E85D3A' : p.pct <= 58 ? '#F2993A' : p.pct <= 83 ? '#3A8FF2' : '#4CAF50';
      return `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
          <span style="font-weight: 600; color: #333;">${p.name}</span>
          <span style="color: ${color}; font-weight: 600;">${p.score}/${p.max} (${p.pct}%)</span>
        </div>
        <div style="background: #f0f0f0; border-radius: 6px; height: 8px; overflow: hidden;">
          <div style="background: ${color}; height: 100%; width: ${p.pct}%; border-radius: 6px;"></div>
        </div>
      </div>`;
    }).join('')}
  </div>

  <!-- SUGGESTED OFFERS -->
  <div style="background: #FFF5F0; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #F26B3A33;">
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #F26B3A;">🎯 Offres à proposer</h2>
    ${weakest3.map(p => `
      <div style="padding: 8px 0; font-size: 14px; color: #333;">
        <strong>${offerMap[p.name] || 'Accompagnement global'}</strong>
        <span style="color: #888;"> — faiblesse sur "${p.name}" (${p.score}/${p.max})</span>
      </div>
    `).join('')}
  </div>

  <!-- RESEARCH LINKS -->
  <div style="background: #F0F5FF; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #3A8FF233;">
    <h2 style="margin: 0 0 12px; font-size: 18px; color: #3A8FF2;">🔍 Recherche</h2>
    <p style="font-size: 14px; margin: 8px 0;"><a href="${linkedinSearchContact}" style="color: #3A8FF2;">🔗 LinkedIn — ${contactName}</a></p>
    ${linkedinSearchCompany ? `<p style="font-size: 14px; margin: 8px 0;"><a href="${linkedinSearchCompany}" style="color: #3A8FF2;">🔗 LinkedIn — ${company.name}</a></p>` : ''}
    ${googleSearchCompany ? `<p style="font-size: 14px; margin: 8px 0;"><a href="${googleSearchCompany}" style="color: #3A8FF2;">🔗 Google — ${company.name}</a></p>` : ''}
    ${googleNewsCompany ? `<p style="font-size: 14px; margin: 8px 0;"><a href="${googleNewsCompany}" style="color: #3A8FF2;">🔗 Google News — ${company.name}</a></p>` : ''}
  </div>

  <!-- ALL ANSWERS -->
  <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #eee;">
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #333;">📝 Détail des réponses</h2>
    ${answers.map((a, i) => `
      <div style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px;">
        <div style="color: #888; font-size: 11px; margin-bottom: 4px;">${a.pillar} — Q${i+1}</div>
        <div style="color: #333; font-weight: 500; margin-bottom: 4px;">${a.question}</div>
        <div style="color: ${a.score <= 1 ? '#E85D3A' : a.score <= 2 ? '#F2993A' : a.score <= 3 ? '#3A8FF2' : '#4CAF50'}; font-weight: 600;">
          → ${a.answer} <span style="font-weight: 400; color: #888;">(${a.answerDetail})</span>
          <span style="float: right;">${a.score}/4</span>
        </div>
      </div>
    `).join('')}
  </div>

  <!-- CTA -->
  <div style="text-align: center; padding: 24px;">
    <a href="mailto:${contact.email}?subject=${encodeURIComponent(`${contact.firstname}, votre diagnostic IA HomoSapIA`)}"
       style="display: inline-block; background: #F26B3A; color: white; padding: 14px 32px; border-radius: 100px; text-decoration: none; font-weight: 600; font-size: 15px;">
      Répondre à ${contact.firstname} →
    </a>
  </div>

</body>
</html>`;

    // ============================================================
    // 2. Send notification email via Resend (or fallback log)
    // ============================================================
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'philippe@4jours.work';

    if (RESEND_API_KEY) {
      // Send via Resend
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'HomoSapIA Diagnostic <diagnostic@homosapia.com>',
          to: [NOTIFY_EMAIL],
          subject: `🎯 Diagnostic IA — ${contact.firstname} ${contact.lastname} @ ${company.name || 'N/A'} (${scores.total}/60)`,
          html: emailHtml
        })
      });

      if (!emailResponse.ok) {
        const errText = await emailResponse.text();
        console.error('Resend error:', errText);
        // Don't fail — we still want to log the data
      }
    } else {
      // No Resend key — just log
      console.log('=== NEW DIAGNOSTIC ===');
      console.log(`Contact: ${contact.firstname} ${contact.lastname} <${contact.email}>`);
      console.log(`Company: ${company.name} (${company.sector}, ${company.size})`);
      console.log(`Score: ${scores.total}/60 (${level})`);
      console.log('Pillars:', scores.pillars.map(p => `${p.name}: ${p.score}/12`).join(', '));
      console.log('======================');
    }

    // ============================================================
    // 3. Store in a simple JSON log (Vercel KV or file)
    // ============================================================
    // For now, the email notification IS the storage
    // Later: add HubSpot integration, KV store, or Notion DB

    return res.status(200).json({
      success: true,
      message: 'Diagnostic received',
      level
    });

  } catch (error) {
    console.error('Diagnostic API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
