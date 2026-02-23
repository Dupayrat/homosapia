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
    const lang = ['en', 'es', 'fr'].includes(data.lang) ? data.lang : 'fr';

    // Sanitize all user-provided strings
    contact.firstname = esc(contact.firstname);
    contact.lastname = esc(contact.lastname);
    contact.phone = esc(contact.phone);
    if (company) {
      company.name = esc(company.name);
      company.website = esc(company.website);
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
    const dateLocales = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };
    const dateStr = new Date(timestamp).toLocaleDateString(dateLocales[lang] || 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

    // ================================================================
    // EMAIL INTERNATIONALIZATION
    // ================================================================
    const EMAIL_I18N = {
      fr: {
        subject: (name, score) => `${name}, votre diagnostic IA est prêt (${score}/100)`,
        title: 'Votre diagnostic IA',
        greeting: (name) => `${name}, voici vos résultats`,
        scoreLabel: 'Score global',
        pillarLabel: 'Détail par pilier',
        strengthLabel: '✦ Votre point fort',
        recoLabel: 'Ce que nous vous recommandons',
        stepLabel: 'Étape',
        ctaTitle: 'Discutons de vos résultats',
        ctaDesc: "30 minutes pour transformer ce diagnostic en plan d'action concret",
        ctaBtn: 'Prendre rendez-vous →',
        gammaLabel: '📊 Votre présentation personnalisée',
        gammaDesc: 'Un rapport complet en slides avec votre analyse détaillée et nos recommandations.',
        gammaBtn: 'Voir ma présentation →',
        gammaNote: 'Disponible sous quelques minutes après réception de cet email'
      },
      en: {
        subject: (name, score) => `${name}, your AI diagnostic is ready (${score}/100)`,
        title: 'Your AI Diagnostic',
        greeting: (name) => `${name}, here are your results`,
        scoreLabel: 'Overall score',
        pillarLabel: 'Pillar breakdown',
        strengthLabel: '✦ Your top strength',
        recoLabel: 'What we recommend',
        stepLabel: 'Step',
        ctaTitle: "Let's discuss your results",
        ctaDesc: '30 minutes to turn this diagnostic into a concrete action plan',
        ctaBtn: 'Book a call →',
        gammaLabel: '📊 Your personalized presentation',
        gammaDesc: 'A complete slide report with your detailed analysis and our recommendations.',
        gammaBtn: 'View my presentation →',
        gammaNote: 'Available within a few minutes of receiving this email'
      },
      es: {
        subject: (name, score) => `${name}, su diagnóstico IA está listo (${score}/100)`,
        title: 'Su diagnóstico IA',
        greeting: (name) => `${name}, estos son sus resultados`,
        scoreLabel: 'Puntuación global',
        pillarLabel: 'Detalle por pilar',
        strengthLabel: '✦ Su punto fuerte',
        recoLabel: 'Lo que le recomendamos',
        stepLabel: 'Etapa',
        ctaTitle: 'Hablemos de sus resultados',
        ctaDesc: '30 minutos para transformar este diagnóstico en un plan de acción concreto',
        ctaBtn: 'Reservar una cita →',
        gammaLabel: '📊 Su presentación personalizada',
        gammaDesc: 'Un informe completo en diapositivas con su análisis detallado y nuestras recomendaciones.',
        gammaBtn: 'Ver mi presentación →',
        gammaNote: 'Disponible en unos minutos tras recibir este email'
      }
    };
    const t = EMAIL_I18N[lang] || EMAIL_I18N.fr;

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
    // GAMMA PRESENTATION — Sector use cases & size context
    // ================================================================
    const SECTOR_USE_CASES = {
      'Services B2B': {
        title: "L'IA dans les Services B2B",
        cases: [
          { name: 'Qualification automatique de leads', impact: '-40% temps commercial', source: 'McKinsey 2024' },
          { name: 'Rédaction de propositions assistée par IA', impact: '+60% de rapidité', source: 'Accenture' },
          { name: 'Analyse prédictive du churn client', impact: '+25% rétention', source: 'BCG' },
          { name: 'Automatisation du reporting client', impact: '-70% temps de consolidation', source: 'Deloitte' }
        ],
        benchmark: "Les leaders du B2B investissent 2-4% de leur CA dans l'IA. Les early movers gagnent un avantage compétitif durable."
      },
      'Industrie': {
        title: "L'IA dans l'Industrie",
        cases: [
          { name: 'Maintenance prédictive des équipements', impact: '-30% coûts maintenance', source: 'McKinsey 2024' },
          { name: 'Contrôle qualité par vision IA', impact: '-60% défauts non détectés', source: 'BCG' },
          { name: 'Optimisation de la chaîne logistique', impact: '-15% coûts logistiques', source: 'Gartner' },
          { name: 'Planification de production intelligente', impact: '+20% efficacité', source: 'Deloitte' }
        ],
        benchmark: "L'industrie 4.0 génère en moyenne 15-20% de gains de productivité pour les entreprises qui intègrent l'IA dans leurs processus."
      },
      'Tech/SaaS': {
        title: "L'IA dans la Tech & le SaaS",
        cases: [
          { name: 'Copilot développeur (code assisté par IA)', impact: '+55% productivité dev', source: 'GitHub 2024' },
          { name: 'Support client augmenté par IA', impact: '-40% tickets L1', source: 'Zendesk' },
          { name: 'Détection d\'anomalies et monitoring intelligent', impact: '-65% incidents critiques', source: 'Gartner' },
          { name: 'Personnalisation produit en temps réel', impact: '+30% engagement', source: 'McKinsey' }
        ],
        benchmark: "Les éditeurs SaaS leaders intègrent l'IA comme différenciateur produit. 80% des roadmaps tech incluent des fonctionnalités IA d'ici 2026."
      },
      'Commerce/Retail': {
        title: "L'IA dans le Commerce & Retail",
        cases: [
          { name: 'Recommandations personnalisées', impact: '+15-35% panier moyen', source: 'McKinsey' },
          { name: 'Prévision de la demande', impact: '-25% ruptures de stock', source: 'BCG' },
          { name: 'Pricing dynamique intelligent', impact: '+5-10% marge', source: 'Deloitte' },
          { name: 'Chatbot commercial et SAV', impact: '-50% temps de réponse', source: 'Gartner' }
        ],
        benchmark: "Le retail est le secteur où le ROI de l'IA est le plus rapide : les premiers résultats sont visibles en 3-6 mois."
      },
      'Santé': {
        title: "L'IA dans la Santé",
        cases: [
          { name: 'Aide au diagnostic médical', impact: '+20% précision diagnostique', source: 'Nature Medicine' },
          { name: 'Optimisation des plannings soignants', impact: '-30% heures supplémentaires', source: 'McKinsey Health' },
          { name: 'Analyse automatisée de comptes-rendus', impact: '-60% temps administratif', source: 'Accenture' },
          { name: 'Détection précoce de pathologies', impact: '+40% détection précoce', source: 'WHO' }
        ],
        benchmark: "La santé est un secteur où l'IA éthique et souveraine est essentielle. La conformité RGPD et AI Act est un prérequis absolu."
      },
      'Finance/Assurance': {
        title: "L'IA dans la Finance & l'Assurance",
        cases: [
          { name: 'Détection de fraude en temps réel', impact: '-70% fraudes non détectées', source: 'McKinsey' },
          { name: 'Scoring crédit augmenté', impact: '+25% précision scoring', source: 'BCG' },
          { name: 'Automatisation de la conformité (KYC/AML)', impact: '-50% coûts compliance', source: 'Deloitte' },
          { name: 'Gestion intelligente des sinistres', impact: '-40% temps de traitement', source: 'Accenture' }
        ],
        benchmark: "La finance investit massivement dans l'IA avec un ROI moyen de 3-5x. La clé : gouvernance des données et explicabilité des modèles."
      },
      'BTP': {
        title: "L'IA dans le BTP",
        cases: [
          { name: 'Estimation automatisée des coûts', impact: '+30% précision devis', source: 'McKinsey' },
          { name: 'Suivi de chantier par drone + vision IA', impact: '-20% retards', source: 'BCG' },
          { name: 'Planification prédictive des projets', impact: '-15% dépassements budget', source: 'Deloitte' },
          { name: 'Gestion documentaire intelligente', impact: '-50% temps recherche docs', source: 'Accenture' }
        ],
        benchmark: "Le BTP est un secteur à fort potentiel IA mais faible maturité digitale. Les quick wins se concentrent sur la gestion documentaire et l'estimation."
      },
      'Conseil/ESN': {
        title: "L'IA dans le Conseil et les ESN",
        cases: [
          { name: 'Rédaction de propositions commerciales assistée', impact: '+60% rapidité proposals', source: 'Accenture' },
          { name: 'Analyse documentaire et veille sectorielle automatisée', impact: '-50% temps de recherche', source: 'McKinsey 2024' },
          { name: 'Automatisation du staffing et matching consultant-mission', impact: '+30% taux de staffing', source: 'BCG' },
          { name: 'Génération de livrables et reporting client', impact: '-40% temps de production', source: 'Deloitte' }
        ],
        benchmark: "Les cabinets leaders intègrent l'IA dans leur delivery et leur méthodologie. Le ROI se mesure en heures vendues libérées et en qualité de livrables."
      },
      'Éducation/Formation': {
        title: "L'IA dans l'Éducation et la Formation",
        cases: [
          { name: 'Personnalisation des parcours apprenants', impact: '+40% taux de complétion', source: 'UNESCO 2024' },
          { name: 'Création de contenus pédagogiques assistée', impact: '-60% temps de conception', source: 'McKinsey' },
          { name: 'Évaluation et feedback automatisés', impact: '+25% qualité feedback', source: 'BCG Education' },
          { name: 'Détection précoce du décrochage', impact: '+35% rétention apprenants', source: 'Deloitte' }
        ],
        benchmark: "L'éducation est à un tournant : l'IA peut démocratiser l'accès à un enseignement de qualité, à condition de maintenir l'humain au cœur de la pédagogie."
      },
      'Transport/Logistique': {
        title: "L'IA dans le Transport et la Logistique",
        cases: [
          { name: 'Optimisation des tournées et itinéraires', impact: '-15% coûts transport', source: 'McKinsey 2024' },
          { name: 'Prévision de la demande et gestion des stocks', impact: '-25% ruptures de stock', source: 'Gartner' },
          { name: 'Maintenance prédictive de la flotte', impact: '-30% pannes imprévues', source: 'BCG' },
          { name: 'Automatisation de la documentation douanière', impact: '-50% temps administratif', source: 'Deloitte' }
        ],
        benchmark: "La logistique est un des secteurs où le ROI de l'IA est le plus mesurable : chaque % d'optimisation se traduit directement en marge."
      },
      'Énergie/Environnement': {
        title: "L'IA dans l'Énergie et l'Environnement",
        cases: [
          { name: 'Prévision de la production EnR (solaire, éolien)', impact: '+20% précision prévisions', source: 'IEA 2024' },
          { name: 'Optimisation de la consommation énergétique', impact: '-15% consommation', source: 'McKinsey' },
          { name: 'Maintenance prédictive des installations', impact: '-30% coûts maintenance', source: 'BCG' },
          { name: 'Reporting ESG et bilan carbone automatisé', impact: '-60% temps de reporting', source: 'Deloitte' }
        ],
        benchmark: "L'énergie combine enjeux de performance et de sobriété. L'IA frugale y est un impératif, pas un luxe."
      },
      'Média/Communication': {
        title: "L'IA dans les Médias et la Communication",
        cases: [
          { name: 'Génération de contenu assistée (articles, posts, vidéos)', impact: '+300% volume de contenu', source: 'Reuters 2024' },
          { name: 'Personnalisation de l\'audience et ciblage', impact: '+25% engagement', source: 'McKinsey' },
          { name: 'Veille et monitoring média automatisés', impact: '-70% temps de veille', source: 'Gartner' },
          { name: 'Traduction et localisation automatique', impact: '-80% coûts de traduction', source: 'Accenture' }
        ],
        benchmark: "Les médias sont le secteur le plus directement impacté par la GenAI. La clé : augmenter les créatifs, pas les remplacer."
      },
      'Secteur public': {
        title: "L'IA dans le Secteur Public",
        cases: [
          { name: 'Simplification des démarches administratives', impact: '-40% temps de traitement', source: 'OCDE 2024' },
          { name: 'Analyse prédictive des besoins citoyens', impact: '+30% satisfaction usagers', source: 'McKinsey Govt' },
          { name: 'Automatisation du traitement des courriers et demandes', impact: '-60% délais de réponse', source: 'Deloitte' },
          { name: 'Aide à la décision et analyse de données territoriales', impact: '+25% efficacité budgétaire', source: 'BCG' }
        ],
        benchmark: "Le secteur public a des contraintes spécifiques : souveraineté des données, AI Act, transparence algorithmique. L'accompagnement est indispensable."
      },
      'Autre': {
        title: "L'IA pour votre entreprise",
        cases: [
          { name: 'Automatisation des processus administratifs', impact: '-40% tâches manuelles', source: 'McKinsey 2024' },
          { name: 'Assistant IA pour la rédaction et communication', impact: '+50% rapidité rédaction', source: 'Accenture' },
          { name: 'Analyse de données et reporting intelligent', impact: '-60% temps de reporting', source: 'Deloitte' },
          { name: 'Formation et montée en compétences par IA', impact: '+35% rétention formation', source: 'BCG' }
        ],
        benchmark: "Quel que soit votre secteur, les quick wins IA se concentrent sur l'automatisation des tâches répétitives et l'augmentation de la productivité."
      }
    };

    const SIZE_CONTEXT = {
      '1-20': "Pour une TPE, les quick wins IA se concentrent sur l'automatisation des tâches répétitives (facturation, emails, reporting). Budget recommandé : 500-2 000 €/mois. Objectif : libérer 5-10h/semaine par collaborateur.",
      '21-50': "Pour une PME de cette taille, l'IA crée un levier d'efficacité massive. Ciblez 2-3 processus clés. Budget recommandé : 2 000-5 000 €/mois. Un référent IA interne est un accélérateur.",
      '51-200': "À votre taille, une stratégie IA structurée est indispensable. Un CDO ou référent IA dédié est recommandé. Budget : 5 000-15 000 €/mois. L'enjeu : industrialiser les premiers succès.",
      '201-1000': "Les ETI qui réussissent leur transformation IA combinent un sponsor C-level, une équipe dédiée et un partenaire expert. Budget IA : 0.5-2% du CA. L'enjeu : gouvernance et scalabilité.",
      '1000+': "Les grandes organisations ont besoin d'un framework IA complet : gouvernance, Centre of Excellence, et programmes de formation massifs. Les leaders investissent 2-5% de leur CA."
    };

    // ================================================================
    // GAMMA PRESENTATION — Build the prompt for personalized deck
    // ================================================================
    const GAMMA_API_KEY = process.env.GAMMA_API_KEY;
    let gammaUrl = null;
    console.log('GAMMA_API_KEY defined:', !!GAMMA_API_KEY);

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
${company.website ? `Site web : ${company.website}` : ''}
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

### Slide 6 — ${(SECTOR_USE_CASES[company.sector] || SECTOR_USE_CASES['Autre']).title}
En tant qu'acteur ${company.sector ? `du secteur ${company.sector}` : 'de votre secteur'}${company.size ? ` (${company.size} collaborateurs)` : ''}, voici les cas d'usage IA les plus impactants :

${(SECTOR_USE_CASES[company.sector] || SECTOR_USE_CASES['Autre']).cases.map((c, i) => `${i+1}. **${c.name}** — ${c.impact} (${c.source})`).join('\n')}

${(SECTOR_USE_CASES[company.sector] || SECTOR_USE_CASES['Autre']).benchmark}

### Slide 7 — IA adaptée à votre taille d'entreprise
${SIZE_CONTEXT[company.size] || SIZE_CONTEXT['21-50']}

Ce que font les entreprises comparables à la vôtre :
- Investir dans 2-3 cas d'usage prioritaires à fort ROI
- Commencer par les quick wins (résultats en 30 jours)
- Mesurer systématiquement l'impact avant de passer à l'échelle

### Slide 8 — Étape recommandée 1 : ${step1.title}
**${step1.subtitle}**

${step1.desc}

Ce que ça couvre :
${step1.details.map(d => `- ${d}`).join('\n')}

Format : ${step1.format}

### Slide 9 — Étape recommandée 2 : ${step2.title}
**${step2.subtitle}**

${step2.desc}

Ce que ça couvre :
${step2.details.map(d => `- ${d}`).join('\n')}

Format : ${step2.format}

### Slide 10 — Pourquoi Homo SapIA
Une approche unique qui allie expertise IA et vision humaine.

Philippe du Payrat accompagne les dirigeants et leurs équipes dans la transformation IA avec une conviction : la technologie doit servir l'humain, pas l'inverse.

Les études le confirment :
- 95% des projets GenAI échouent faute d'accompagnement humain (MIT 2025)
- La clé du succès IA : 70% personnes & processus, 20% tech, 10% algorithmes (BCG)
- L'IA mal déployée intensifie le travail et crée du burnout (HBR / UC Berkeley 2026)
→ Notre approche place l'humain au centre : qui initie, comprend, valide et bénéficie.

Nos engagements :
- Approche éthique et souveraine, pas de "tech-washing"
- Méthodologie pragmatique : des résultats mesurables en semaines, pas en mois
- Expertise terrain : +50 entreprises accompagnées
- Réseau d'experts complémentaires (data, sécurité, RH, juridique)
- Formateur certifié : emlyon, Covéa CFE-CGC, PME et ETI

### Slide 11 — Références & confiance
Ils font confiance à Homo SapIA :
- Covéa (CFE-CGC) : conférence IA et accompagnement stratégique
- emlyon business school : formation IA pour cadres dirigeants
- +50 entreprises accompagnées (PME, ETI, grands groupes)
- Interventions sectorielles : ${company.sector || 'services, industrie, tech, finance'}

Certifications et labels :
- Expert IA certifié
- Approche conforme AI Act et RGPD
- Méthodologie frugale et responsable

### Slide 12 — Prochaines étapes
${contact.firstname}, prenons 30 minutes pour :
1. Approfondir vos résultats et répondre à vos questions
2. Identifier vos quick wins à lancer dès cette semaine
3. Définir ensemble votre feuille de route IA

Philippe du Payrat
philippe@homosapia.com · homosapia.com
Réservez votre créneau : meetings.hubspot.com/pdu-payrat`;

    // Call Gamma API to generate personalized presentation
    let gammaGenerationId = null;
    console.log('Gamma prompt length:', gammaPrompt.length, 'chars');
    if (GAMMA_API_KEY) {
      try {
        console.log('Calling Gamma API...');
        const gammaBody = {
          inputText: gammaPrompt,
          textMode: 'preserve',
          format: 'presentation',
          numCards: 12,
          exportAs: 'pdf',
          textOptions: { language: lang === 'es' ? 'es' : lang === 'en' ? 'en' : 'fr' },
          sharingOptions: { externalAccess: 'view' }
        };
        const gammaRes = await fetch('https://public-api.gamma.app/v1.0/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': GAMMA_API_KEY
          },
          body: JSON.stringify(gammaBody)
        });
        console.log('Gamma API response status:', gammaRes.status);
        if (gammaRes.ok) {
          const gammaData = await gammaRes.json();
          console.log('Gamma API response keys:', Object.keys(gammaData).join(', '));
          gammaGenerationId = gammaData.generationId || gammaData.id || null;
          if (gammaGenerationId) {
            gammaUrl = `https://gamma.app/generations/${gammaGenerationId}`;
            console.log('Gamma generation started:', gammaGenerationId);
          } else {
            console.error('Gamma API returned OK but no generationId/id. Full response:', JSON.stringify(gammaData).substring(0, 500));
          }
        } else {
          const errorBody = await gammaRes.text();
          console.error('Gamma API error:', gammaRes.status, errorBody.substring(0, 500));
        }
      } catch (gammaErr) {
        console.error('Gamma API call failed:', gammaErr.message, gammaErr.stack?.substring(0, 300));
      }
    } else {
      console.log('Gamma: NO API KEY — skipping generation for', contactName);
    }

    // ================================================================
    // EMAIL 1 — To PROSPECT (diagnostic report, Homo SapIA branded)
    // ================================================================
    const prospectEmailHtml = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title} - Homo SapIA</title>
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
          <p style="font-size: 13px; text-transform: uppercase; letter-spacing: 3px; color: #F26B3A; margin: 0 0 16px; font-weight: 600;">${t.title}</p>
          <h1 style="font-size: 36px; font-weight: 300; color: #E8E6E1; margin: 0 0 8px; line-height: 1.2;">${t.greeting(contact.firstname)}</h1>
          ${company.name ? `<p style="font-size: 15px; color: #8A8A95; margin: 12px 0 0;">${company.name}${company.sector ? ' · ' + company.sector : ''}${company.size ? ' · ' + company.size + ' collab.' : ''}</p>` : ''}
        </td></tr>

        <tr><td style="height: 24px;"></td></tr>

        <!-- Score Global -->
        <tr><td style="background: #16161F; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 32px; text-align: center;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #8A8A95; margin: 0 0 16px; font-weight: 500;">${t.scoreLabel}</p>
          <p style="font-size: 64px; font-weight: 700; color: ${lc.bg}; margin: 0; line-height: 1;">${scores.total}<span style="font-size: 24px; color: #8A8A95; font-weight: 400;"> / ${scores.maxTotal}</span></p>
          <p style="display: inline-block; margin: 16px 0 0; padding: 8px 20px; border-radius: 100px; font-size: 14px; font-weight: 600; color: ${lc.bg}; background: ${lc.bg}15;">${level}</p>
        </td></tr>

        <tr><td style="height: 24px;"></td></tr>

        <!-- Pillar Scores -->
        <tr><td style="background: #16161F; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 32px;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #8A8A95; margin: 0 0 24px; font-weight: 500; text-align: center;">${t.pillarLabel}</p>
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
          <p style="font-size: 13px; font-weight: 600; color: #3A8FF2; margin: 0 0 8px;">${t.strengthLabel}</p>
          <p style="font-size: 16px; color: #E8E6E1; margin: 0; line-height: 1.5;"><strong>${strongest.name}</strong> - ${strongest.score}/${strongest.max} (${strongest.pct}%)</p>
        </td></tr>

        <tr><td style="height: 24px;"></td></tr>

        <!-- Étapes recommandées -->
        <tr><td style="background: #16161F; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 32px;">
          <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #F26B3A; margin: 0 0 24px; font-weight: 500; text-align: center;">${t.recoLabel}</p>
          ${recommendedSteps.map((step, i) => `
          <div style="margin-bottom: ${i === 0 ? '24px' : '0'}; padding-bottom: ${i === 0 ? '24px' : '0'}; border-bottom: ${i === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none'};">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size: 15px; font-weight: 600; color: #E8E6E1;">${t.stepLabel} ${step.num} : ${step.title}</td>
              </tr>
            </table>
            <p style="font-size: 13px; color: #3A8FF2; margin: 4px 0 8px; font-weight: 500;">${step.subtitle}</p>
            <p style="font-size: 14px; color: #8A8A95; margin: 0; line-height: 1.5;">${step.desc.substring(0, 180)}${step.desc.length > 180 ? '...' : ''}</p>
          </div>`).join('')}
        </td></tr>

        <tr><td style="height: 32px;"></td></tr>

        <!-- CTA -->
        <tr><td style="text-align: center; padding: 32px; background: linear-gradient(135deg, rgba(242, 107, 58, 0.08) 0%, rgba(58, 143, 242, 0.08) 100%); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px;">
          <p style="font-size: 22px; font-weight: 300; color: #E8E6E1; margin: 0 0 8px; line-height: 1.3;">${t.ctaTitle}</p>
          <p style="font-size: 14px; color: #8A8A95; margin: 0 0 24px;">${t.ctaDesc}</p>
          <a href="https://meetings-eu1.hubspot.com/pdu-payrat?uuid=5a24cb40-61aa-41f5-aee3-8cc6a8cae0bf" style="display: inline-block; background: #F26B3A; color: #ffffff; padding: 14px 36px; border-radius: 100px; text-decoration: none; font-size: 15px; font-weight: 600;">${t.ctaBtn}</a>
        </td></tr>

        <tr><td style="height: 24px;"></td></tr>

        <!-- Gamma Presentation Link -->
        ${gammaGenerationId ? `
        <tr><td style="background: #16161F; border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 28px 32px; text-align: center;">
          <p style="font-size: 13px; font-weight: 600; color: #3A8FF2; margin: 0 0 8px;">${t.gammaLabel}</p>
          <p style="font-size: 14px; color: #8A8A95; margin: 0 0 20px;">${t.gammaDesc}</p>
          <a href="https://homosapia.com/api/track?id=${gammaGenerationId}&email=${encodeURIComponent(contact.email)}&name=${encodeURIComponent(contactName)}&company=${encodeURIComponent(company.name || contactName)}" style="display: inline-block; background: #3A8FF2; color: #ffffff; padding: 12px 32px; border-radius: 100px; text-decoration: none; font-size: 14px; font-weight: 600;">${t.gammaBtn}</a>
          <p style="font-size: 11px; color: #555; margin: 12px 0 0;">${t.gammaNote}</p>
        </td></tr>

        <tr><td style="height: 24px;"></td></tr>
        ` : ''}

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
      <tr><td style="padding: 4px 0; font-weight: 600;">Site web</td><td>${company.website ? `<a href="${company.website}" target="_blank">${company.website}</a>` : '-'}</td></tr>
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
    ${company.website ? `<p style="font-size: 14px; margin: 6px 0;"><a href="${company.website}">🌐 Site web - ${company.website}</a></p>` : ''}
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
            subject: t.subject(contact.firstname, scores.total),
            html: prospectEmailHtml,
            scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
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
            subject: `🎯 LEAD - ${contactName} @ ${company.name || 'N/A'} - ${scores.total}/100 (${level})`,
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
      console.log(`Company: ${company.name} | Score: ${scores.total}/100 (${level})`);
      console.log('Steps:', recommendedSteps.map(s => `${s.num}. ${s.title}`).join(' | '));
      console.log('=======================================');
    }

    // Pre-warm Drive cache: trigger PDF processing in the background
    // By the time the prospect receives the email (5 min), PDF should be on Drive
    if (gammaGenerationId) {
      const warmupUrl = `https://homosapia.com/api/track?id=${encodeURIComponent(gammaGenerationId)}&warmup=true`;
      console.log(`🔥 Launching Drive warmup for ${gammaGenerationId}`);
      fetch(warmupUrl).catch(() => {});
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
