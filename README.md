# DigiCommune

Application de gestion municipale pour collectivités territoriales de Côte d'Ivoire.
Permet aux citoyens de soumettre des demandes d'actes civils en ligne, et aux agents de les traiter via un backoffice complet.

## Stack technique

- **Framework** : SvelteKit (SSR + SPA)
- **Style** : Tailwind CSS avec thème dynamique (CSS custom properties)
- **Stockage** : JSON files (data/) — pas de base de données, zéro dépendance externe
- **PDF** : Génération côté client

## Fonctionnalités

### Portail citoyen
- Dépôt de demandes (acte de naissance, mariage, décès, attestations, certifications…)
- Suivi de dossier par numéro unique (format `CI-XXXXXXXXXX`)
- 13 types de services civils

### Backoffice
| Rôle | Accès |
|------|-------|
| **Agent** | Traitement des demandes, notes internes, escalades |
| **Superviseur** | Tableau de bord, gestion des escalades, stats |
| **Maire** | Vue synthétique avec graphiques, cas critiques |
| **Super Admin** | Configuration complète du système |

### Super Admin
- **Identité** : Logo, nom de l'application, couleur principale (thème dynamique), slogan, horaires
- **Modules** : Activation/désactivation des 13 services
- **Utilisateurs** : Ajout/désactivation d'agents et superviseurs
- **Paramètres système** : 10+ paramètres configurables (frais, SLA, délais légaux, WhatsApp, notifications…)
- **Verrouillages** : 14 paramètres verrouillables pour empêcher leur modification par les autres rôles
- **Modèles de documents** : Upload de templates DOCX/ODT/PDF par type de service
- **Journal d'audit** : Historique complet de toutes les actions

## Structure des données (`data/`)

| Fichier | Contenu |
|---------|---------|
| `commune.json` | Identité de la mairie (nom, logo, couleur, slogan, horaires…) |
| `settings.json` | Paramètres système (SLA, frais, modules, verrouillages…) |
| `demandes.json` | Toutes les demandes civiles |
| `utilisateurs.json` | Agents, superviseurs, maire |
| `notifications.json` | Notifications internes |
| `audit.json` | Journal d'audit |
| `templates.json` | Modèles de documents uploadés |

## Lancer en local

```bash
npm install
npm run dev
```

## Accès backoffice

Se connecter via `/agent/login` avec les rôles disponibles :
- `agent` / `superviseur` / `maire` / `superadmin`

## Personnalisation (Super Admin → Identité)

1. Uploader un logo (PNG/JPG/SVG)
2. Choisir la couleur principale via le sélecteur — le thème est appliqué en temps réel sur toute l'app
3. Modifier le nom de l'application, le slogan et les horaires d'ouverture
