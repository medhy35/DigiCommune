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
| **Maire** | Vue synthétique avec graphiques, cas critiques, gestion équipe |
| **Super Admin** | Configuration complète du système |

### Super Admin
- **Identité** : Logo, nom de l'application, couleur principale (thème dynamique), slogan, horaires
- **Modules** : Activation/désactivation des 13 services
- **Utilisateurs** : Ajout, modification et désactivation des agents, superviseurs et du maire
- **Paramètres système** : 10+ paramètres configurables (frais, SLA, délais légaux, WhatsApp, notifications…)
- **Verrouillages** : 14 paramètres verrouillables pour empêcher leur modification par les autres rôles
- **Modèles de documents** : Upload de templates DOCX/ODT/PDF par type de service
- **Journal d'audit** : Historique complet de toutes les actions sur les dossiers
- **Journal de sécurité** : Historique des événements système (connexions, modifications, suppressions)

### Maire
- **Équipe** : Ajout, modification et désactivation des agents et superviseurs

## Structure des données (`data/`)

| Fichier | Contenu |
|---------|---------|
| `commune.json` | Identité de la mairie (nom, logo, couleur, slogan, horaires…) |
| `settings.json` | Paramètres système (SLA, frais, modules, verrouillages…) |
| `demandes.json` | Toutes les demandes civiles |
| `utilisateurs.json` | Agents, superviseurs, maire |
| `notifications.json` | Notifications internes (agents, superviseurs, maire) |
| `audit.json` | Journal d'audit des dossiers |
| `templates.json` | Modèles de documents uploadés |
| `security_log.json` | Journal de sécurité (connexions, actions admin, événements système) |

## Journal de sécurité — types d'événements

| Type | Description | Acteur |
|------|-------------|--------|
| `connexion` | Connexion au backoffice | tous |
| `deconnexion` | Déconnexion | tous |
| `user_add` | Ajout d'un utilisateur | superadmin |
| `user_update` | Modification d'un utilisateur | superadmin, maire |
| `user_toggle` | Activation / désactivation d'un utilisateur | superadmin, maire |
| `module_toggle` | Module activé ou désactivé | superadmin |
| `settings_change` | Paramètres globaux modifiés | superadmin |
| `role_settings_change` | Paramètres d'un rôle modifiés | superadmin |
| `param_lock` | Paramètre verrouillé | superadmin |
| `param_unlock` | Paramètre déverrouillé | superadmin |
| `identite_change` | Identité de la mairie modifiée | superadmin |
| `template_upload` | Modèle de document chargé | superadmin |
| `template_delete` | Modèle de document supprimé | superadmin |
| `journal_efface` | Journal de sécurité effacé | superadmin |
| `statut_change` | Statut d'une demande modifié | agent, superviseur |
| `reassignation` | Demande réassignée à un autre agent | superviseur |
| `acte_valide` | Acte civil validé | agent |
| `complement_demande` | Compléments d'information demandés au citoyen | agent |
| `note_interne` | Note interne ajoutée à un dossier | agent, superviseur |
| `escalade_ajout` | Escalade créée | agent |
| `escalade_resolue` | Escalade résolue | superviseur |
| `paiement_valide` | Paiement validé en mairie | agent |
| `remboursement_initie` | Remboursement initié | agent, superviseur |
| `remboursement_valide` | Remboursement effectué | superviseur |

## Notifications internes — types

| Type | Destinataire | Déclencheur |
|------|-------------|-------------|
| `nouvelle_demande` | agent | Nouvelle demande soumise |
| `escalade` | superviseur | Escalade créée par un agent |
| `escalade_critique` | superviseur, maire | Demande en dépassement SLA |
| `info` | tous | Notification générique système |
| `remboursement` | agent | Remboursement validé ou initié |
| `bienvenue` | agent, superviseur, maire | Compte créé par le superadmin ou le maire |

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
