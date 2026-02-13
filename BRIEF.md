# Homo SapIA - Brief Projet pour Claude Code

## Objectif

Créer et déployer le site web de Homo SapIA sur Vercel, avec Supabase pour le backend (formulaires, analytics, blog futur).

## Stack technique cible

- **Framework** : Next.js 14+ (App Router)
- **Styling** : Tailwind CSS 4
- **Animations** : Framer Motion
- **Hébergement** : Vercel
- **Backend/DB** : Supabase (contacts, leads, analytics)
- **Domaine** : homosapia.com (à configurer sur Vercel)
- **CMS futur** : soit Notion comme CMS, soit Supabase tables pour blog/ressources

## Pages à créer

### 1. Page d'accueil (existante, à migrer en Next.js)
Le fichier `src/index-reference.html` contient le HTML complet validé. À convertir en composants React/Next.js.

Sections :
- Hero : "L'IA au service de l'humain"
- Trust bar : logos clients
- Convictions : 4 cards (Human in the loop, Temps libéré, Engagement, IA responsable)
- Impact : chiffres clés (30+, 400+, +21%, 91%)
- Conférences : 3 keynotes
- Réalisations : 6 clients (COVEA, HubFrance IA, Plateau Urbain, Serfim TIC, Diapason, Addenda)
- Presse : Capital (lien live), Les Échos, Choiseul, HelloWork
- À propos : Philippe du Payrat (bio complète)
- Partenaires : emlyon, B Lab France, CFE-CGC, Tomorrow Theory, ChangeNOW
- CTA : lien HubSpot meetings
- Footer

### 2. Page Ressources / Outils (à construire)
Pour afficher les frameworks et matrices créés par Philippe :
- Matrice organisationnelle d'adoption GenAI TPE-PME
- Matrice Valeur x Énergie (photo atelier Maria Schools)
- AI for HR Opportunity Heatmap
- IA en Formation : Entraîner l'Esprit, pas le Décharger
- 10 Skills IA à maîtriser
- Pyramide de la stratégie

Images dans `assets/images-inspiration/`

### 3. Page Blog (v2, optionnelle pour le lancement)

## Intégrations

- **HubSpot** : CTA "Prendre RDV" → https://meetings-eu1.hubspot.com/pdu-payrat?uuid=5a24cb40-61aa-41f5-aae3-8cc6a8cae0bf
- **Email** : philippe@homosapia.com
- **LinkedIn** : à récupérer
- **Supabase** : stocker les soumissions de formulaire de contact (backup du HubSpot)

## Données clients (pour la section Réalisations)

| Client | Secteur | Taille | Mission | Résultat clé |
|--------|---------|--------|---------|--------------|
| COVEA | Assurance | 22 000 | Conférence temps de travail x IA | Clarification stratégique COMEX |
| HubFrance IA | Écosystème IA | - | Expertise croisée IA + orga | Contributions IA responsable France |
| Plateau Urbain | Immobilier solidaire | 100 | Transformation complète + S4J | -40% réunions, +3h prod/sem |
| Serfim TIC | BTP | 280 | Ateliers IA 2 jours | 45 initiés, roadmap IA |
| Diapason | SaaS Finance | 250 | Audit IA complet | Rapport 60p, plan 3 phases |
| Addenda | Bureau d'études | 20 | Pilote transformation | +90% satisfaction |
| B Lab France | Certification B Corp | - | Sensibilisation IA | Acculturation possibilités IA |
| CFC-COVEA | Assurance mutuelle | - | - | - |

## Données conférences

### Keynote 1 : IA et organisation du travail
- De la hype à la réalité
- Human in the loop
- Que fait-on du temps libéré ?
- Organisations AI-enabled & human-centered
- Format : 45-60 min ou + atelier 1h30

### Keynote 2 : Les futurs du travail probables
- 3 transitions (éco, démo, techno)
- 5 futurs interconnectés
- Cas de pionniers
- Feuille de route 2025-2030
- Format : 45-60 min ou + atelier 1h30

### Keynote 3 : Repenser le temps de travail
- 400+ pilotes, 15 pays
- 30 formats possibles
- Mythes vs réalités
- Plan d'action en 5 étapes
- Format : 45-60 min ou + atelier 1h30

## Bio Philippe du Payrat

Expert français des futurs du travail. Fondateur Homo SapIA + 4jours.work.
Professeur vacataire emlyon (Cap 2035 : Futurs du Travail Ne(x)twork).

Parcours : COO La Ruche Qui Dit Oui, DG MaVoie.org (4x Google.org), Google, Simon-Kucher, AramisAuto.

Distinctions : Alumni ESCP 2022, Prix Envi 2025, ChangeNOW expert depuis 2023.

Communautés : The AI Fellowship, Savoy IA.

## SEO

- Title : "Homo SapIA | L'IA au service de l'humain"
- Meta : "Homo SapIA accompagne les entreprises dans leur transformation par l'IA et l'organisation du travail."
- OG image : à créer
- Mots clés : IA entreprise, transformation organisationnelle, human in the loop, temps libéré, conférence IA, futurs du travail

## Fichiers de référence dans ce dossier

- `docs/DESIGN-SYSTEM.md` : charte graphique complète
- `src/index-reference.html` : HTML v2 validé (à migrer en Next.js)
- `assets/images-inspiration/` : visuels LinkedIn et frameworks de Philippe
