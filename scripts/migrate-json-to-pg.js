#!/usr/bin/env node
/**
 * Script de migration : JSON files → PostgreSQL
 *
 * Usage:
 *   COMMUNE_ID=cocody DATABASE_URL=postgresql://... node scripts/migrate-json-to-pg.js
 *
 * Ce script :
 * 1. Crée la commune si elle n'existe pas
 * 2. Migre les utilisateurs (avec un mot de passe temporaire)
 * 3. Migre les settings
 * 4. Migre les demandes
 * 5. Migre les notifications
 * 6. Migre les rendez-vous
 * 7. Migre les templates
 * 8. Migre les codes de vérification (inclus dans les demandes)
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma    = new PrismaClient();
const DATA_DIR  = join(process.cwd(), 'data');
const COMMUNE_ID = process.env.COMMUNE_ID;

if (!COMMUNE_ID) {
	console.error('❌  Variable COMMUNE_ID manquante.');
	process.exit(1);
}

function readJSON(file) {
	const path = join(DATA_DIR, file);
	if (!existsSync(path)) { console.warn(`  ⚠ ${file} introuvable, ignoré.`); return null; }
	return JSON.parse(readFileSync(path, 'utf-8'));
}

const DEFAULT_PASSWORD = process.env.DEFAULT_PASSWORD || 'DigiCommune2025!';

async function main() {
	console.log(`\n🚀  Migration JSON → PostgreSQL pour la commune : ${COMMUNE_ID}`);
	console.log(`📁  Répertoire source : ${DATA_DIR}\n`);

	// ── 1. Commune ────────────────────────────────────────────
	const communeData = readJSON('commune.json');
	if (communeData) {
		await prisma.commune.upsert({
			where:  { id: COMMUNE_ID },
			update: {
				nom:                communeData.nom                || '',
				nom_app:            communeData.nom_app            || 'DigiCommune',
				region:             communeData.region             || '',
				adresse:            communeData.adresse            || '',
				telephone:          communeData.telephone          || '',
				email:              communeData.email              || '',
				site:               communeData.site               || '',
				maire:              communeData.maire              || '',
				slogan:             communeData.slogan             || '',
				horaires_ouverture: communeData.horaires_ouverture || '',
				couleur_primaire:   communeData.couleur_primaire   || '#009A44',
				logo:               communeData.logo               || null
			},
			create: {
				id:                 COMMUNE_ID,
				nom:                communeData.nom                || COMMUNE_ID,
				nom_app:            communeData.nom_app            || 'DigiCommune',
				region:             communeData.region             || '',
				adresse:            communeData.adresse            || '',
				telephone:          communeData.telephone          || '',
				email:              communeData.email              || '',
				site:               communeData.site               || '',
				maire:              communeData.maire              || '',
				slogan:             communeData.slogan             || '',
				horaires_ouverture: communeData.horaires_ouverture || '',
				couleur_primaire:   communeData.couleur_primaire   || '#009A44',
				logo:               communeData.logo               || null
			}
		});
		console.log(`✅  Commune "${COMMUNE_ID}" créée/mise à jour.`);
	}

	// ── 2. Settings ───────────────────────────────────────────
	const settingsData = readJSON('settings.json');
	if (settingsData) {
		await prisma.settings.upsert({
			where:  { commune_id: COMMUNE_ID },
			update: { data: settingsData },
			create: { commune_id: COMMUNE_ID, data: settingsData }
		});
		console.log('✅  Settings migrés.');
	}

	// ── 3. Utilisateurs ───────────────────────────────────────
	const usersData = readJSON('utilisateurs.json');
	if (usersData) {
		const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
		const allUsers     = [
			...(usersData.agents       || []).map(u => ({ ...u, role: 'agent' })),
			...(usersData.superviseurs || []).map(u => ({ ...u, role: 'superviseur' })),
			...(usersData.maire        ? [{ ...usersData.maire,       role: 'maire'      }] : []),
			...(usersData.superadmin   ? [{ ...usersData.superadmin,  role: 'superadmin' }] : [])
		];

		let count = 0;
		for (const u of allUsers) {
			await prisma.utilisateur.upsert({
				where:  { commune_id_email: { commune_id: COMMUNE_ID, email: u.email } },
				update: {
					nom:    u.nom,
					prenom: u.prenom,
					role:   u.role,
					avatar: u.avatar || (u.prenom[0] + u.nom[0]).toUpperCase(),
					actif:  u.actif !== false
				},
				create: {
					id:            u.id || undefined,
					commune_id:    COMMUNE_ID,
					nom:           u.nom,
					prenom:        u.prenom,
					role:          u.role,
					email:         u.email,
					avatar:        u.avatar || (u.prenom[0] + u.nom[0]).toUpperCase(),
					actif:         u.actif !== false,
					password_hash: passwordHash
				}
			});
			count++;
		}
		console.log(`✅  ${count} utilisateurs migrés (mot de passe temporaire : "${DEFAULT_PASSWORD}").`);
	}

	// ── 4. Demandes ───────────────────────────────────────────
	const demandes = readJSON('demandes.json');
	if (demandes && Array.isArray(demandes)) {
		let count = 0;
		for (const d of demandes) {
			try {
				await prisma.demande.upsert({
					where:  { id: d.id },
					update: {
						statut:             d.statut,
						type_acte:          d.type_acte,
						concernant:         d.concernant,
						demandeur:          d.demandeur,
						personne_concernee: d.personne_concernee ?? null,
						copies:             d.copies       ?? 1,
						mode_reception:     d.mode_reception ?? 'retrait',
						documents:          d.documents     ?? [],
						paiement:           d.paiement      ?? {},
						agent_id:           d.agent_id      ?? null,
						acte:               d.acte          ?? null,
						verification_codes: d.verification_codes ?? {},
						complement_demande: d.complement_demande ?? null,
						complement_fourni:  d.complement_fourni  ?? null,
						escalade:           d.escalade      ?? null,
						historique:         d.historique    ?? [],
						updated_at:         d.updated_at ? new Date(d.updated_at) : new Date()
					},
					create: {
						id:                 d.id,
						commune_id:         COMMUNE_ID,
						created_at:         d.created_at ? new Date(d.created_at) : new Date(),
						updated_at:         d.updated_at ? new Date(d.updated_at) : new Date(),
						statut:             d.statut      ?? 'recue',
						type_acte:          d.type_acte,
						concernant:         d.concernant,
						demandeur:          d.demandeur,
						personne_concernee: d.personne_concernee ?? null,
						copies:             d.copies       ?? 1,
						mode_reception:     d.mode_reception ?? 'retrait',
						documents:          d.documents     ?? [],
						paiement:           d.paiement      ?? {},
						agent_id:           d.agent_id      ?? null,
						acte:               d.acte          ?? null,
						verification_codes: d.verification_codes ?? {},
						complement_demande: d.complement_demande ?? null,
						complement_fourni:  d.complement_fourni  ?? null,
						escalade:           d.escalade      ?? null,
						historique:         d.historique    ?? []
					}
				});
				count++;
			} catch (err) {
				console.error(`  ❌ Erreur demande ${d.id} :`, err.message);
			}
		}
		console.log(`✅  ${count}/${demandes.length} demandes migrées.`);
	}

	// ── 5. Notifications ──────────────────────────────────────
	const notifications = readJSON('notifications.json');
	if (notifications && Array.isArray(notifications)) {
		let count = 0;
		for (const n of notifications) {
			try {
				const exists = await prisma.notification.findUnique({ where: { id: n.id } });
				if (!exists) {
					await prisma.notification.create({
						data: {
							id:         n.id,
							commune_id: COMMUNE_ID,
							role:       n.role,
							type:       n.type,
							message:    n.message,
							demande_id: n.demande_id ?? null,
							read:       n.read ?? false,
							created_at: n.created_at ? new Date(n.created_at) : new Date()
						}
					});
					count++;
				}
			} catch {}
		}
		console.log(`✅  ${count}/${notifications.length} notifications migrées.`);
	}

	// ── 6. Rendez-vous ────────────────────────────────────────
	const rdvList = readJSON('rendez_vous.json');
	if (rdvList && Array.isArray(rdvList)) {
		let count = 0;
		for (const r of rdvList) {
			try {
				const exists = await prisma.rendezVous.findUnique({ where: { id: r.id } });
				if (!exists) {
					await prisma.rendezVous.create({
						data: {
							id:         r.id,
							commune_id: COMMUNE_ID,
							demande_id: r.demande_id,
							demandeur:  r.demandeur ?? {},
							date_rdv:   r.date_rdv,
							heure_rdv:  r.heure_rdv,
							lieu:       r.lieu       ?? 'Mairie',
							statut:     r.statut     ?? 'en_attente',
							note_agent: r.note_agent ?? null,
							created_at: r.created_at ? new Date(r.created_at) : new Date(),
							updated_at: r.updated_at ? new Date(r.updated_at) : new Date()
						}
					});
					count++;
				}
			} catch (err) {
				console.error(`  ❌ Erreur RDV ${r.id} :`, err.message);
			}
		}
		console.log(`✅  ${count}/${rdvList.length} rendez-vous migrés.`);
	}

	// ── 7. Templates ──────────────────────────────────────────
	const templates = readJSON('templates.json');
	if (templates && typeof templates === 'object') {
		let count = 0;
		for (const [type, t] of Object.entries(templates)) {
			try {
				await prisma.template.upsert({
					where:  { commune_id_type: { commune_id: COMMUNE_ID, type } },
					update: {
						nom_fichier: t.nom_fichier,
						taille:      t.taille      ?? 0,
						uploaded_by: t.uploaded_by ?? 'superadmin',
						has_data:    t.has_data    ?? true,
						file_path:   t.file_path   ?? '',
						ext:         t.ext         ?? 'docx'
					},
					create: {
						commune_id:  COMMUNE_ID,
						type,
						nom_fichier: t.nom_fichier,
						taille:      t.taille      ?? 0,
						uploaded_at: t.uploaded_at ? new Date(t.uploaded_at) : new Date(),
						uploaded_by: t.uploaded_by ?? 'superadmin',
						has_data:    t.has_data    ?? true,
						file_path:   t.file_path   ?? '',
						ext:         t.ext         ?? 'docx'
					}
				});
				count++;
			} catch (err) {
				console.error(`  ❌ Erreur template ${type} :`, err.message);
			}
		}
		console.log(`✅  ${count} templates migrés.`);
	}

	console.log('\n✨  Migration terminée avec succès !');
	console.log(`\n⚠️  Mot de passe temporaire pour tous les utilisateurs : "${DEFAULT_PASSWORD}"`);
	console.log('    → Changer les mots de passe après la première connexion.\n');
}

main()
	.catch(err => { console.error('\n❌  Erreur critique :', err); process.exit(1); })
	.finally(() => prisma.$disconnect());
