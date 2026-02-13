# Première instruction pour Claude Code

Copie-colle ceci dans Claude Code après avoir ouvert le dossier `homosapia-project/` :

---

```
Lis BRIEF.md et docs/DESIGN-SYSTEM.md pour comprendre le projet.

Tu dois créer le site web HomoSapIA :
- Next.js 14+ (App Router) + Tailwind CSS 4 + Framer Motion
- Déploiement sur Vercel
- Supabase pour les formulaires de contact (backup HubSpot)

Étapes :
1. Initialise le projet Next.js avec Tailwind et Framer Motion
2. Convertis src/index-reference.html en composants React (garde la structure exacte et le design system de docs/DESIGN-SYSTEM.md)
3. Configure Vercel (vercel.json si nécessaire)
4. Configure Supabase (table contacts : name, email, company, message, created_at)
5. Connecte le domaine homosapia.com sur Vercel

Contraintes strictes :
- Zéro em dash (—) dans tout le contenu
- Jamais "PDP", toujours "Philippe du Payrat"
- Pas de mention "4 Day Week Global" ni "semaine de 4 jours" (sauf lien 4jours.work)
- Langue : français
- Design : dark theme bleu nuit (#0A0A0F), accent orange (#F26B3A), bleu sapiens (#3A8FF2)
- Fonts : Instrument Serif (titres) + DM Sans (corps)

Commence par l'étape 1 : initialise le projet.
```
