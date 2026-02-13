# Présentations Diagnostic IA

Ce dossier contient les présentations PDF générées suite aux diagnostics IA réalisés par les prospects.

## Convention de nommage

`YYYY-MM-DD_entreprise_prenom-nom.pdf`

Exemple : `2026-02-13_acme-corp_jean-dupont.pdf`

## Workflow

1. Le prospect complète le diagnostic sur homosapia.com/diagnostic.html
2. L'API génère un prompt Gamma personnalisé (envoyé dans l'email interne à Philippe)
3. La présentation est générée via Gamma (manuellement ou via N8N)
4. Le PDF est exporté et stocké ici
5. Le PDF est envoyé au prospect par email
