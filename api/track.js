// Vercel Serverless Function — Smart PDF handler for Gamma presentations
// GET /api/track?id=GENERATION_ID&email=EMAIL&name=NAME&company=COMPANY
// On first click: fetches PDF from Gamma, uploads to Google Drive, redirects to Drive
// On subsequent clicks: redirects to cached Drive PDF instantly

const DRIVE_FOLDER_ID = '1yV4p4_4SSXk856r9-Z2-BBai95kwF5YD';

// ─── Google OAuth2: get access token from refresh token ───
async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth2 token error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ─── Search Drive for existing PDF by gammaGenerationId in appProperties ───
async function searchDriveFile(token, generationId) {
  const query = `'${DRIVE_FOLDER_ID}' in parents and trashed = false and appProperties has { key='gammaGenerationId' and value='${generationId}' }`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&spaces=drive`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Drive search error:', res.status, err);
    return null;
  }
  const data = await res.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

// ─── Upload PDF to Google Drive (multipart/related) ───
async function uploadToDrive(token, pdfBuffer, fileName, generationId) {
  const metadata = {
    name: fileName,
    parents: [DRIVE_FOLDER_ID],
    appProperties: { gammaGenerationId: generationId }
  };

  const boundary = '===BOUNDARY_HOMOSAPIA===';
  const metadataStr = JSON.stringify(metadata);

  // Build multipart/related body
  const header = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}\r\n--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  const footer = `\r\n--${boundary}--`;

  const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');
  const body = header + pdfBase64 + footer;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: body
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload error: ${res.status} ${err}`);
  }
  return await res.json();
}

// ─── Make file publicly readable ───
async function makeFilePublic(token, fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role: 'reader', type: 'anyone' })
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Permission error:', res.status, err);
  }
}

// ─── Send notification email to Philippe ───
function notifyPhilippe({ name, email, company, driveUrl, timestamp }) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'philippe@homosapia.com';

  if (!RESEND_API_KEY || !email) return;

  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Homo SapIA Bot <diagnostic@homosapia.com>',
      to: [NOTIFY_EMAIL],
      subject: `📊 ${name || email} a consulté son diagnostic IA`,
      html: `<div style="font-family:sans-serif;max-width:500px;padding:20px;">
        <h2 style="margin:0 0 12px;">📊 Clic sur le diagnostic PDF</h2>
        <p><strong>Qui :</strong> ${name || 'N/A'} &lt;${email}&gt;</p>
        ${company ? `<p><strong>Entreprise :</strong> ${company}</p>` : ''}
        <p><strong>Quand :</strong> ${timestamp}</p>
        <p><strong>PDF :</strong> <a href="${driveUrl}">${driveUrl}</a></p>
        <hr style="margin:16px 0;border:none;border-top:1px solid #eee;">
        <p style="color:#888;font-size:12px;">Ce prospect montre de l'intérêt — c'est le bon moment pour le relancer. 🔥</p>
      </div>`
    })
  }).catch(() => {}); // fire-and-forget
}

// ─── Main handler ───
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { id, email, name, company } = req.query;
  if (!id) return res.redirect(302, 'https://homosapia.com');

  const gammaUrl = `https://gamma.app/generations/${id}`;
  const timestamp = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

  console.log(`📊 CLICK | ${name || 'Unknown'} <${email || 'N/A'}> | ${company || '-'} | ${timestamp}`);

  // Check if Google Drive credentials are configured
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.log('⚠️ Google Drive not configured — falling back to Gamma URL');
    notifyPhilippe({ name, email, company, driveUrl: gammaUrl, timestamp });
    return res.redirect(302, gammaUrl);
  }

  try {
    // Step 1: Get Google Drive access token
    const token = await getAccessToken();
    console.log('✅ Google OAuth2 token obtained');

    // Step 2: Check if PDF already exists on Drive (cache)
    const existingFile = await searchDriveFile(token, id);
    if (existingFile) {
      const driveUrl = `https://drive.google.com/file/d/${existingFile.id}/view?usp=sharing`;
      console.log(`📁 Cache hit — redirecting to existing Drive PDF: ${driveUrl}`);
      notifyPhilippe({ name, email, company, driveUrl, timestamp });
      return res.redirect(302, driveUrl);
    }

    // Step 3: Fetch Gamma generation status
    console.log(`🔍 Checking Gamma generation status for ${id}...`);
    const gammaRes = await fetch(`https://public-api.gamma.app/v1.0/generations/${id}`, {
      headers: { 'X-API-KEY': process.env.GAMMA_API_KEY }
    });

    if (!gammaRes.ok) {
      console.error(`Gamma API error: ${gammaRes.status}`);
      notifyPhilippe({ name, email, company, driveUrl: gammaUrl, timestamp });
      return res.redirect(302, gammaUrl);
    }

    const gammaData = await gammaRes.json();
    console.log(`Gamma status: ${gammaData.status}, hasExportUrl: ${!!gammaData.exportUrl}`);

    // Step 4: If not completed or no exportUrl, fallback to Gamma
    if (gammaData.status !== 'completed' || !gammaData.exportUrl) {
      console.log(`⏳ Gamma not ready (status: ${gammaData.status}) — falling back to Gamma URL`);
      notifyPhilippe({ name, email, company, driveUrl: gammaUrl, timestamp });
      return res.redirect(302, gammaUrl);
    }

    // Step 5: Download PDF from Gamma
    console.log(`⬇️ Downloading PDF from Gamma exportUrl...`);
    const pdfRes = await fetch(gammaData.exportUrl);
    if (!pdfRes.ok) {
      console.error(`PDF download failed: ${pdfRes.status}`);
      notifyPhilippe({ name, email, company, driveUrl: gammaUrl, timestamp });
      return res.redirect(302, gammaUrl);
    }
    const pdfBuffer = await pdfRes.arrayBuffer();
    console.log(`✅ PDF downloaded: ${(pdfBuffer.byteLength / 1024).toFixed(1)} KB`);

    // Step 6: Upload to Google Drive
    const dateStr = new Date().toLocaleDateString('fr-FR', {
      timeZone: 'Europe/Paris',
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).replace(/\//g, '-');
    const companyName = company || name || 'Prospect';
    const fileName = `HomoSapIA - Diagnostic IA - ${companyName} - ${dateStr}.pdf`;

    console.log(`⬆️ Uploading to Drive: ${fileName}`);
    const driveFile = await uploadToDrive(token, pdfBuffer, fileName, id);
    console.log(`✅ Uploaded to Drive: ${driveFile.id}`);

    // Step 7: Make file publicly readable
    await makeFilePublic(token, driveFile.id);
    console.log(`🔓 File made public`);

    const driveUrl = `https://drive.google.com/file/d/${driveFile.id}/view?usp=sharing`;
    console.log(`🎯 Redirecting to Drive PDF: ${driveUrl}`);

    // Notify Philippe (fire-and-forget)
    notifyPhilippe({ name, email, company, driveUrl, timestamp });

    return res.redirect(302, driveUrl);

  } catch (err) {
    console.error('❌ PDF pipeline error:', err.message, err.stack?.substring(0, 300));
    // Fallback: redirect to Gamma on any error
    notifyPhilippe({ name, email, company, driveUrl: gammaUrl, timestamp });
    return res.redirect(302, gammaUrl);
  }
}
