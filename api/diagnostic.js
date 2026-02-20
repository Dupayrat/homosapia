// Vercel Serverless Function — receives diagnostic data, sends emails + generates Gamma presentation
// POST /api/diagnostic

// Sanitize user input to prevent HTML injection in emails
function esc(str) {
  if (!str || typeof str !== 'string') return str || '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Basic email format validation
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
    const data = req.body;
    if (!data.contact || !data.contact.email || !data.scores) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!isValidEmail(data.contact.email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const { contact, company, scores, answers, level, timestamp } = data;

    // Sanitize all user-provided strings
    contact.firstname = esc(contact.firstname);
    contact.lastname = esc(contact.lastname);
    contact.phone = esc(contact.phone);
    if (company) {
      company.name = esc(company.name);
      company.sector = esc(company.sector);
      company.size = esc(company.size);
      company.role = esc(company.role);
    }
    if (answers) {
      answers.forEach(a => {
        a.question = esc(a.question);
        a.answer = esc(a.answer);
        a.pillar = esc(a.pillar);
      });
    }
    const contactName = `${contact.firstname} ${contact.lastname}`;
    const dateStr = new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

    // ================================================================
    // OFFER & RECOMMENDATION MAPPING
    // ================================================================
    const offerMap = {
      'Shadow IA & Usages': { name: 'Audit IA & opérationnel', desc: 'Cartographier vos usages IA et sécuriser vos données', type: 'audit' },
      'Souveraineté & Data': { name: 'Accompagnement global', desc: 'Structurer votre stratégie data souveraine et conforme', type: 'audit' },
      'Frugalité & Impact': { name: 'Ateliers pratiques', desc: 'Adopter une IA sobre et mesurer votre ROI', type: 'atelier' },
      'Éthique & Gouvernance': { name: 'Projet pilote & déploiement', desc: 'Mettre en place votre charte IA et vos processus de gouvernance', type: 'audit' },
      'Acculturation & Compétences': { name: 'Formations IA', desc: 'Former vos équipes à tous les niveaux (CODIR, managers, opérationnels)', type: 'formation' }
    };

    const sortedPillars = [...scores.pillars].sort((a, b) => a.score - b.score);
    const weakest3 = sortedPillars.slice(0, 3);
    const weakest2 = sortedPillars.slice(0, 2);
    const strongest = [...scores.pillars].sort((a, b) => b.score - a.score)[0];
    const strongPillars = [...scores.pillars].sort((a, b) => b.score - a.score).slice(0, 2);

    // Smart step recommendations based on maturity level + weakest pillars
    function getRecommendedSteps(level, weakest) {
      const steps = [];

      if (level === 'Éveil') {
        steps.push({
          num: 1,
          title: 'Conférence de sensibilisation IA',
          subtitle: '2 heures pour embarquer votre direction',
          desc: `Pour votre niveau actuel, la priorité est d'aligner les parties prenantes sur les enjeux et opportunités de l'IA. Une conférence interactive permettra de démystifier l'IA, montrer les risques du statu quo (notamment le Shadow IA), et ouvrir la voie à une démarche structurée.`,
          details: [
            'État de l\'art de l\'IA appliquée à votre secteur (' + (company.sector || 'votre activité') + ')',
            'Risques concrets : Shadow IA, souveraineté des données, conformité',
            'Cas d\'usage actionnables et démonstrations live',
            'Feuille de route rapide : les 3 premières actions à lancer'
          ],
          format: '2h en présentiel ou distanciel · CODIR + managers · Impact immédiat'
        });
        steps.push({
          num: 2,
          title: 'Audit IA & cartographie des usages',
          subtitle: '2-3 semaines pour structurer votre démarche',
          desc: `Suite à la conférence, un audit permettra de poser un diagnostic terrain : quels outils sont utilisés, par qui, avec quelles données, et quels risques. L'objectif est de passer d'une posture réactive à une stratégie IA maîtrisée.`,
          details: [
            'Cartographie complète des usages IA (officiels et shadow)',
            'Évaluation des risques : données sensibles, conformité, souveraineté',
            'Identification des 3-5 cas d\'usage à fort ROI',
            'Livrable : rapport + plan d\'action priorisé + charte IA draft'
          ],
          format: '2-3 semaines · Interviews + analyse · Livrable complet'
        });
      } else if (level === 'Exploration') {
        // Check if biggest gap is skills/training vs governance
        const hasSkillGap = weakest.some(w => w.name === 'Acculturation & Compétences');
        const hasGovGap = weakest.some(w => w.name === 'Éthique & Gouvernance');

        steps.push({
          num: 1,
          title: hasGovGap ? 'Audit IA & cadrage stratégique' : 'Conférence IA & ateliers pratiques',
          subtitle: hasGovGap ? '3-4 semaines pour structurer votre stratégie' : '1 journée pour accélérer vos équipes',
          desc: hasGovGap
            ? `Vos bases existent, mais le cadre manque. L'audit permettra de structurer une gouvernance IA claire, évaluer votre conformité (AI Act), et définir une stratégie alignée sur vos enjeux business.`
            : `Vos fondations sont bonnes. L'enjeu est maintenant d'accélérer l'adoption en montant vos équipes en compétence sur les bons outils et les bonnes pratiques.`,
          details: hasGovGap
            ? [
              'Audit de conformité : AI Act, RGPD, souveraineté des données',
              'Cartographie des risques et opportunités par département',
              'Co-construction de votre charte IA et processus de validation',
              'Feuille de route 6-12 mois avec KPIs mesurables'
            ] : [
              'Conférence CODIR : vision stratégique et cas sectoriels',
              'Ateliers pratiques par équipe : prompts, outils, workflows IA',
              'Identification de champions IA internes',
              'Kit de démarrage : guides, modèles, checklist de bonnes pratiques'
            ],
          format: hasGovGap
            ? '3-4 semaines · Interviews + ateliers · Livrable stratégique'
            : '1 journée · Présentiel · Tous niveaux'
        });
        steps.push({
          num: 2,
          title: hasGovGap ? 'Formation IA par niveaux' : 'Audit opérationnel & feuille de route',
          subtitle: hasGovGap ? 'Programmes adaptés CODIR / managers / opérationnels' : '2-3 semaines pour identifier vos quick wins',
          desc: hasGovGap
            ? `Une fois le cadre posé, montez vos équipes en compétence avec des formations calibrées par profil. L'objectif : autonomie et adoption pérenne.`
            : `Pour passer à l'échelle, un audit opérationnel identifiera vos meilleurs leviers et structurera une feuille de route pragmatique.`,
          details: hasGovGap
            ? [
              'CODIR : enjeux stratégiques, ROI, gouvernance IA',
              'Managers : piloter des projets IA, évaluer les risques',
              'Équipes : prompting avancé, automatisations, outils métier',
              'Suivi post-formation et communauté interne'
            ] : [
              'Cartographie des processus à fort potentiel IA',
              'Évaluation ROI par cas d\'usage (temps, coûts, qualité)',
              'Plan de déploiement priorisé avec pilotes',
              'Mise en place de métriques de suivi'
            ],
          format: hasGovGap
            ? 'Modules de 2-4h · Présentiel ou distanciel · Supports inclus'
            : '2-3 semaines · Terrain + analyse · Plan d\'action actionnable'
        });
      } else if (level === 'Accélération') {
        steps.push({
          num: 1,
          title: 'Projet pilote & déploiement ciblé',
          subtitle: '4-6 semaines pour prouver la valeur',
          desc: `Votre maturité permet de passer directement à l'action. Identifions ensemble un cas d'usage à fort impact sur ${weakest[0].name.toLowerCase()}, lançons un pilote mesuré, et construisons le playbook pour le déploiement à l'échelle.`,
          details: [
            'Sélection du cas d\'usage optimal (impact x faisabilité)',
            'Setup technique et intégration dans vos workflows existants',
            'Pilote avec KPIs : avant/après mesurés sur 4 semaines',
            'Playbook de déploiement pour les autres équipes'
          ],
          format: '4-6 semaines · Sprint agile · ROI mesuré'
        });
        steps.push({
          num: 2,
          title: 'Accompagnement à l\'échelle',
          subtitle: 'Industrialiser vos succès IA',
          desc: `Transformez vos pilotes réussis en capacités permanentes. Structurez votre centre d'excellence IA interne et déployez les bonnes pratiques à l'ensemble de l'organisation.`,
          details: [
            'Formation des champions IA et référents métier',
            'Mise en place de la gouvernance IA (charte, processus, revues)',
            'Plateforme de partage : cas d\'usage, prompts, retours d\'expérience',
            'Programme d\'amélioration continue et veille technologique'
          ],
          format: '2-3 mois · Accompagnement flexible · Centre d\'excellence'
        });
      } else {
        // Excellence
        steps.push({
          num: 1,
          title: 'Innovation & cas d\'usage avancés',
          subtitle: 'Explorez les frontières de l\'IA pour votre secteur',
          desc: `Votre maturité est avancée. L'enjeu est d'explorer les cas d'usage de nouvelle génération : agents IA, RAG sur vos données, automatisations complexes, et de maintenir votre avance concurrentielle.`,
          details: [
            'Exploration des cas d\'usage avancés (agents, RAG, fine-tuning)',
            'Benchmark concurrentiel et veille sectorielle',
            'Optimisation de votre stack IA (coûts, performance, frugalité)',
            'Workshop innovation avec vos équipes'
          ],
          format: 'Sur mesure · Innovation lab · Retour mesurable'
        });
        steps.push({
          num: 2,
          title: 'Conférence interne & acculturation continue',
          subtitle: 'Maintenir la dynamique et l\'adoption',
          desc: `Partagez vos succès, inspirez vos équipes, et maintenez l'élan. Une conférence interne permet de célébrer les quick wins, partager les retours d'expérience et ouvrir de nouvelles perspectives.`,
          details: [
            'Retours d\'expérience des projets IA déployés',
            'Nouvelles tendances et opportunités pour votre secteur',
            'Atelier de co-construction : prochains cas d\'usage',
            'Networking avec d\'autres entreprises avancées'
          ],
          format: '2-3h · Keynote + ateliers · Inspiration & action'
        });
      }
      return steps;
    }

    const recommendedSteps = getRecommendedSteps(level, weakest2);

    // Level colors
    const levelColors = {
      'Éveil': { bg: '#E85D3A', light: '#FFF0EB' },
      'Exploration': { bg: '#F2993A', light: '#FFF5EB' },
      'Accélération': { bg: '#3A8FF2', light: '#EBF3FF' },
      'Excellence': { bg: '#4CAF50', light: '#ECFAED' }
    };
    const lc = levelColors[level] || levelColors['Exploration'];

    // ================================================================
    // GAMMA PRESENTATION — Build the prompt for personalized deck
    // ================================================================
    const GAMMA_API_KEY = process.env.GAMMA_API_KEY;
    let gammaUrl = null;

    // Build a rich text prompt for Gamma
    const pillarSummary = scores.pillars.map(p => {
      const status = p.pct <= 33 ? '🔴 Critique' : p.pct <= 58 ? '🟠 À renforcer' : p.pct <= 83 ? '🔵 Correct' : '🟢 Point fort';
      return `- ${p.name} : ${p.score}/${p.max} (${p.pct}%) ${status}`;
    }).join('\n');

    const step1 = recommendedSteps[0];
    const step2 = recommendedSteps[1];

    const gammaPrompt = `## Présentation : Diagnostic de maturité IA — ${company.name || contactName}

### Slide 1 — Couverture
**Diagnostic de maturité IA**
${company.name ? `Entreprise : ${company.name}` : `Pour : ${contactName}`}
${company.sector ? `Secteur : ${company.sector}` : ''}
Réalisé le ${dateStr}
Préparé par Philippe du Payrat · Homo SapIA
"L'IA au service de l'humain"

### Slide 2 — Votre score global
Score de maturité IA : **${scores.total} / ${scores.maxTotal}**
Niveau : **${level}**
${level === 'Éveil' ? "Votre entreprise est au début de sa réflexion IA. Tout reste à construire, mais c'est une opportunité formidable." : level === 'Exploration' ? "Des bases existent, il faut structurer. Vous avez l'avantage de ne pas partir de zéro." : level === 'Accélération' ? "Vous avez de bonnes fondations. Il est temps de passer à l'échelle et d'industrialiser vos initiatives." : "Votre maturité IA est avancée. Concentrez-vous sur l'optimisation et l'innovation continue."}

### Slide 3 — Analyse par pilier
Résultats détaillés sur les 5 piliers d'évaluation :
${pillarSummary}

### Slide 4 — Vos atouts
${strongPillars.map(p => `**${p.name}** (${p.score}/${p.max} — ${p.pct}%)
C'est un atout pour accélérer votre transformation IA. Capitalisez sur cette force.`).join('\n\n')}

### Slide 5 — Axes de progression prioritaires
${weakest2.map((p, i) => `**${i+1}. ${p.name}** (${p.score}/${p.max} — ${p.pct}%)
${p.pct <= 33 ? 'Niveau critique.' : 'À renforcer.'} ${(offerMap[p.name] || {}).desc || ''}`).join('\n\n')}

### Slide 6 — Étape recommandée 1 : ${step1.title}
**${step1.subtitle}**

${step1.desc}

Ce que ça couvre :
${step1.details.map(d => `- ${d}`).join('\n')}

Format : ${step1.format}

### Slide 7 — Étape recommandée 2 : ${step2.title}
**${step2.subtitle}**

${step2.desc}

Ce que ça couvre :
${step2.details.map(d => `- ${d}`).join('\n')}

Format : ${step2.format}

### Slide 8 — Pourquoi Homo SapIA
Une approche unique qui allie expertise IA et vision humaine.

Philippe du Payrat accompagne les dirigeants et leurs équipes dans la transformation IA avec une conviction : la technologie doit servir l'humain, pas l'inverse.

Nos engagements :
- Approche éthique et souveraine, pas de "tech-washing"
- Méthodologie pragmatique : des résultats mesurables en semaines, pas en mois
- Expertise terrain : +50 entreprises accompagnées
- Réseau d'experts complémentaires (data, sécurité, RH, juridique)
- Formateur certifié : emlyon, Covéa CFE-CGC, PME et ETI

### Slide 9 — Références & confiance
Ils font confiance à Homo SapIA :
- Covéa (CFE-CGC) : conférence IA et accompagnement stratégique
- emlyon business school : formation IA pour cadres dirigeants
- +50 entreprises accompagnées (PME, ETI, grands groupes)
- Interventions sectorielles : ${company.sector || 'services, industrie, tech, finance'}

Certifications et labels :
- Expert IA certifié
- Approche conforme AI Act et RGPD
- Méthodologie frugale et responsable

### Slide 10 — Prochaines étapes
${contact.firstname}, prenons 30 minutes pour :
1. Approfondir vos résultats et répondre à vos questions
2. Identifier vos quick wins à lancer dès cette semaine
3. Définir ensemble votre feuille de route IA

Philippe du Payrat
philippe@homosapia.com · homosapia.com
Réservez votre créneau : meetings.hubspot.com/pdu-payrat`;

    // Call Gamma API to generate personalized presentation (fire-and-forget)
    let gammaGenerationId = null;
    if (GAMMA_API_KEY) {
      try {
        const gammaRes = await fetch('https://public-api.gamma.app/v1.0/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': GAMMA_API_KEY
          },
          body: JSON.stringify({
            inputText: gammaPrompt,
            textMode: 'preserve',
            format: 'presentation',
            numCards: 10
          })
        });
        if (gammaRes.ok) {
          const gammaData = await gammaRes.json();
          gammaGenerationId = gammaData.generationId || gammaData.id || null;
          if (gammaGenerationId) {
            gammaUrl = `https://gamma.app/generations/${gammaGenerationId}`;
            console.log('Gamma generation started:', gammaGenerationId);
          }
        } else {
          console.error('Gamma API error:', gammaRes.status, await gammaRes.text());
        }
      } catch (gammaErr) {
        console.error('Gamma API call failed:', gammaErr.message);
      }
    } else {
      console.log('Gamma presentation prompt generated (no API key):', contactName);
    }

    // ================================================================
    // EMAIL 1 — To PROSPECT (diagnostic report, Homo SapIA branded)
    // ================================================================
    const prospectEmailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Votre diagnostic IA - Homo SapIA</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0F; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #E8E6E1; -webkit-font-smoothing: antialiased;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0A0F;">
    <tr><td align="center" style="padding: 40px 16px;">

      <!-- Main container -->
      <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">

        <!-- Header / Logo -->
        <tr><td style="padding: 0 0 32px; text-align: center;">
          <span style="font-size: 28px; font-weight: 300; color: #E8E6E1; letter-spacing: -0.5px;">Homo Sap</span><span style="font-size: 28px; font-weight: 300; color: #F26B3A; font-style: italic;">IA</span>
        </td></tr>

        <!-- Hero Card -->
        <tr><td style="background: linear-gradient(135deg, #16161F 0%, #12121A 100%); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 40px 32px; text-align: center;">
          <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 3px; color: #F26B3A; margin: 0 0 16px; font-weight: 600;">Votre diagnostic IA</p>
          <h1 style="font-size: 36px; font-weight: 300; color: #E8E6E1; margin: 0 0 8px; line-height: 1.2;">${contact.firstname}, voici<br>vos résultats</h1>
          ${company.name ? `<p style="font-size: 15px; color: #8A8A95; margin: 12px 0 0;">${company.name}${company.sector ? ' · ' + company.sector : ''}${company.size ? ' · ' + company.size + ' collab.' : ''}</p>` : ''}
        </td></tr>

        <tr><td style="height: 24px;"></td></tr>

        <!-- Score Global -->
        <tr><td style="background: #16161F; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 32px; text-align: center;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #8A8A95; margin: 0 0 16px; font-weight: 500;">Score global</p>
          <p style="font-size: 64px; font-weight: 700; color: ${lc.bg}; margin: 0; line-height: 1;">${scores.total}<span style="font-size: 24px; color: #8A8A95; font-weight: 400;"> / ${scores.maxTotal}</span></p>
          <p style="display: inline-block; margin: 16px 0 0; padding: 8px 20px; border-radius: 100px; font-size: 14px; font-weight: 600; color: ${lc.bg}; background: ${lc.bg}15;">${level}</p>
        </td></tr>

        <tr><td style="height: 24px;"></td></tr>

        <!-- Pillar Scores -->
        <tr><td style="background: #16161F; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 32px;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #8A8A95; margin: 0 0 24px; font-weight: 500; text-align: center;">Détail par pilier</p>
          ${scores.pillars.map(p => {
            const color = p.pct <= 33 ? '#E85D3A' : p.pct <= 58 ? '#F2993A' : p.pct <= 83 ? '#3A8FF2' : '#4CAF50';
            return `
          <div style="margin-bottom: 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size: 14px; color: #E8E6E1; font-weight: 500; padding-bottom: 6px;">${p.name}</td>
                <td style="font-size: 14px; color: ${color}; font-weight: 600; text-align: right; padding-bottom: 6px;">${p.score}/${p.max}</td>
              </tr>
            </table>
            <div style="background: rgba(255,255,255,0.06); border-radius: 6px; height: 8px; overflow: hidden;">
              <div style="background: ${color}; height: 100%; width: ${p.pct}%; border-radius: 6px;"></div>
            </div>
          </div>`;
          }).join('')}
        </td></tr>

        <tr><td style="height: 24px;"></td></tr>

        <!-- Point fort -->
        <tr><td style="background: rgba(58, 143, 242, 0.08); border: 1px solid rgba(58, 143, 242, 0.15); border-radius: 16px; padding: 28px 32px;">
          <p style="font-size: 13px; font-weight: 600; color: #3A8FF2; margin: 0 0 8px;">&#10022; Votre point fort</p>
          <p style="font-size: 16px; color: #E8E6E1; margin: 0; line-height: 1.5;"><strong>${strongest.name}</strong> - ${strongest.score}/${strongest.max} (${strongest.pct}%)</p>
        </td></tr>

        <tr><td style="height: 24px;"></td></tr>

        <!-- Étapes recommandées -->
        <tr><td style="background: #16161F; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 32px;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #F26B3A; margin: 0 0 24px; font-weight: 500; text-align: center;">Ce que nous vous recommandons</p>
          ${recommendedSteps.map((step, i) => `
          <div style="margin-bottom: ${i === 0 ? '24px' : '0'}; padding-bottom: ${i === 0 ? '24px' : '0'}; border-bottom: ${i === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none'};">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size: 15px; font-weight: 600; color: #E8E6E1;">Étape ${step.num} : ${step.title}</td>
              </tr>
            </table>
            <p style="font-size: 13px; color: #3A8FF2; margin: 4px 0 8px; font-weight: 500;">${step.subtitle}</p>
            <p style="font-size: 14px; color: #8A8A95; margin: 0; line-height: 1.5;">${step.desc.substring(0, 180)}${step.desc.length > 180 ? '...' : ''}</p>
          </div>`).join('')}
        </td></tr>

        <tr><td style="height: 32px;"></td></tr>

        <!-- CTA -->
        <tr><td style="text-align: center; padding: 32px; background: linear-gradient(135deg, rgba(242, 107, 58, 0.08) 0%, rgba(58, 143, 242, 0.08) 100%); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px;">
          <p style="font-size: 22px; font-weight: 300; color: #E8E6E1; margin: 0 0 8px; line-height: 1.3;">Discutons de vos résultats</p>
          <p style="font-size: 14px; color: #8A8A95; margin: 0 0 24px;">30 minutes pour transformer ce diagnostic en plan d'action concret</p>
          <a href="https://meetings-eu1.hubspot.com/pdu-payrat?uuid=5a24cb40-61aa-41f5-aee3-8cc6a8cae0bf" style="display: inline-block; background: #F26B3A; color: #ffffff; padding: 14px 36px; border-radius: 100px; text-decoration: none; font-size: 15px; font-weight: 600;">Prendre rendez-vous &rarr;</a>
        </td></tr>

        <tr><td style="height: 32px;"></td></tr>

        <!-- Footer -->
        <tr><td style="text-align: center; padding: 24px 0; border-top: 1px solid rgba(255,255,255,0.06);">
          <p style="font-size: 13px; color: #8A8A95; margin: 0 0 4px;">Philippe du Payrat · Homo SapIA</p>
          <p style="font-size: 12px; color: #555; margin: 0;">L'IA au service de l'humain</p>
          <p style="font-size: 11px; color: #444; margin: 12px 0 0;"><a href="https://homosapia.com" style="color: #F26B3A; text-decoration: none;">homosapia.com</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // ================================================================
    // EMAIL 2 — To PHILIPPE (internal notification with research links)
    // ================================================================
    const linkedinContact = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(contactName + ' ' + (company.name || ''))}`;
    const linkedinCompany = company.name ? `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company.name)}` : '';
    const googleCompany = company.name ? `https://www.google.com/search?q=${encodeURIComponent(company.name + ' ' + (company.sector || ''))}` : '';
    const googleNews = company.name ? `https://www.google.com/search?q=${encodeURIComponent(company.name)}&tbm=nws` : '';

    const internalEmailHtml = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; background: #f8f8f8; padding: 20px;">

  <div style="background: #0A0A0F; color: #E8E6E1; border-radius: 16px; padding: 32px; margin-bottom: 20px;">
    <h1 style="margin: 0 0 4px; font-size: 24px;">&#127919; Nouveau diagnostic IA</h1>
    <p style="margin: 0; color: #8A8A95; font-size: 14px;">${new Date(timestamp).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>
  </div>

  <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #eee;">
    <h2 style="margin: 0 0 16px; font-size: 18px; color: #333;">&#128100; ${contactName}</h2>
    <table style="width: 100%; font-size: 14px; color: #333;">
      <tr><td style="padding: 4px 0; font-weight: 600; width: 100px;">Email</td><td><a href="mailto:${contact.email}">${contact.email}</a></td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Téléphone</td><td>${contact.phone || '-'}</td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Entreprise</td><td><strong>${company.name || '-'}</strong></td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Secteur</td><td>${company.sector || '-'}</td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Taille</td><td>${company.size || '-'}</td></tr>
      <tr><td style="padding: 4px 0; font-weight: 600;">Fonction</td><td>${company.role || '-'}</td></tr>
    </table>
  </div>

  <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #eee;">
    <h2 style="margin: 0 0 8px; font-size: 18px; color: #333;">&#128202; ${scores.total}/${scores.maxTotal} - ${level}</h2>
    ${scores.pillars.map(p => {
      const color = p.pct <= 33 ? '#E85D3A' : p.pct <= 58 ? '#F2993A' : p.pct <= 83 ? '#3A8FF2' : '#4CAF50';
      return `<div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 3px;">
          <span>${p.name}</span><span style="color: ${color}; font-weight: 600;">${p.score}/${p.max}</span>
        </div>
        <div style="background: #f0f0f0; border-radius: 4px; height: 6px;"><div style="background: ${color}; height: 100%; width: ${p.pct}%; border-radius: 4px;"></div></div>
      </div>`;
    }).join('')}
  </div>

  <div style="background: #FFF5F0; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #F26B3A33;">
    <h2 style="margin: 0 0 12px; font-size: 16px; color: #F26B3A;">&#127919; Étapes recommandées</h2>
    ${recommendedSteps.map(step => `
    <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #F26B3A15;">
      <p style="font-size: 14px; margin: 0 0 4px;"><strong>Étape ${step.num} : ${step.title}</strong></p>
      <p style="font-size: 13px; color: #666; margin: 0;">${step.subtitle}</p>
    </div>`).join('')}
    <p style="font-size: 12px; color: #999; margin: 8px 0 0;">Basé sur le niveau "${level}" et les faiblesses sur : ${weakest2.map(w => w.name).join(', ')}</p>
  </div>

  <div style="background: #F0F5FF; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #3A8FF233;">
    <h2 style="margin: 0 0 8px; font-size: 16px; color: #3A8FF2;">&#128269; Recherche</h2>
    <p style="font-size: 14px; margin: 6px 0;"><a href="${linkedinContact}">LinkedIn - ${contactName}</a></p>
    ${linkedinCompany ? `<p style="font-size: 14px; margin: 6px 0;"><a href="${linkedinCompany}">LinkedIn - ${company.name}</a></p>` : ''}
    ${googleCompany ? `<p style="font-size: 14px; margin: 6px 0;"><a href="${googleCompany}">Google - ${company.name}</a></p>` : ''}
    ${googleNews ? `<p style="font-size: 14px; margin: 6px 0;"><a href="${googleNews}">Google News - ${company.name}</a></p>` : ''}
  </div>

  <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #eee;">
    <h2 style="margin: 0 0 12px; font-size: 16px; color: #333;">&#128221; Réponses détaillées</h2>
    ${answers.map((a, i) => `
      <div style="padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 12px;">
        <span style="color: #999;">${a.pillar} Q${i+1}</span><br>
        <span style="color: #333;">${a.question}</span><br>
        <strong style="color: ${a.score <= 1 ? '#E85D3A' : a.score <= 2 ? '#F2993A' : a.score <= 3 ? '#3A8FF2' : '#4CAF50'};">&rarr; ${a.answer}</strong>
        <span style="color: #999;">(${a.score}/4)</span>
      </div>
    `).join('')}
  </div>

  <div style="background: #ECFAED; border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #4CAF5033;">
    <h2 style="margin: 0 0 8px; font-size: 16px; color: #4CAF50;">&#128444; Présentation Gamma</h2>
    ${gammaUrl ? `<p style="margin: 0 0 12px; font-size: 14px;"><strong>Génération lancée :</strong> <a href="${gammaUrl}" style="color: #4CAF50;">${gammaUrl}</a></p>` : '<p style="margin: 0 0 12px; font-size: 14px; color: #999;">Génération non lancée (clé API manquante ou erreur)</p>'}
    <details style="margin-top: 8px;">
      <summary style="cursor: pointer; font-size: 12px; color: #666;">Voir le prompt Gamma</summary>
      <pre style="font-size: 11px; color: #333; white-space: pre-wrap; word-wrap: break-word; max-height: 200px; overflow-y: auto; background: white; padding: 12px; border-radius: 8px; border: 1px solid #eee; margin-top: 8px;">${gammaPrompt.substring(0, 2000)}${gammaPrompt.length > 2000 ? '\n...(tronqué)' : ''}</pre>
    </details>
  </div>

  <div style="text-align: center; padding: 20px;">
    <a href="mailto:${contact.email}?subject=${encodeURIComponent(`${contact.firstname}, votre diagnostic IA Homo SapIA`)}" style="display: inline-block; background: #F26B3A; color: white; padding: 14px 32px; border-radius: 100px; text-decoration: none; font-weight: 600;">Répondre à ${contact.firstname} &rarr;</a>
  </div>
</body></html>`;

    // ================================================================
    // SEND EMAILS
    // ================================================================
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'philippe@homosapia.com';

    let emailStatus = { prospect: 'skipped', internal: 'skipped' };

    if (RESEND_API_KEY) {
      // Send prospect email
      try {
        const prospectResult = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Philippe du Payrat <diagnostic@homosapia.com>',
            to: [contact.email],
            subject: `${contact.firstname}, votre diagnostic IA est prêt (${scores.total}/60)`,
            html: prospectEmailHtml
          })
        });

        if (prospectResult.ok) {
          const result = await prospectResult.json();
          emailStatus.prospect = 'sent';
          console.log('Prospect email sent:', result.id);
        } else {
          const errText = await prospectResult.text();
          emailStatus.prospect = 'error';
          console.error('Resend prospect email error:', prospectResult.status, errText);
        }
      } catch (emailErr) {
        emailStatus.prospect = 'error';
        console.error('Resend prospect email failed:', emailErr.message);
      }

      // Send internal notification
      try {
        const internalResult = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Homo SapIA Bot <diagnostic@homosapia.com>',
            to: [NOTIFY_EMAIL],
            subject: `🎯 LEAD - ${contactName} @ ${company.name || 'N/A'} - ${scores.total}/60 (${level})`,
            html: internalEmailHtml
          })
        });

        if (internalResult.ok) {
          emailStatus.internal = 'sent';
          console.log('Internal notification sent to', NOTIFY_EMAIL);
        } else {
          emailStatus.internal = 'error';
          console.error('Resend internal email error:', internalResult.status, await internalResult.text());
        }
      } catch (emailErr) {
        emailStatus.internal = 'error';
        console.error('Resend internal email failed:', emailErr.message);
      }
    } else {
      console.log('=== NEW DIAGNOSTIC (no Resend key) ===');
      console.log(`Contact: ${contactName} <${contact.email}>`);
      console.log(`Company: ${company.name} | Score: ${scores.total}/60 (${level})`);
      console.log('Steps:', recommendedSteps.map(s => `${s.num}. ${s.title}`).join(' | '));
      console.log('=======================================');
    }

    return res.status(200).json({
      success: true,
      level,
      emailStatus,
      steps: recommendedSteps.map(s => ({ num: s.num, title: s.title, subtitle: s.subtitle })),
      gammaPrompt: gammaPrompt.substring(0, 500) + '...',
      gammaUrl: gammaUrl || null,
      gammaGenerationId: gammaGenerationId || null
    });

  } catch (error) {
    console.error('Diagnostic API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
