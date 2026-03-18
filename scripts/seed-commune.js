#!/usr/bin/env node
/**
 * Seed : crée une nouvelle commune avec son superadmin.
 *
 * Usage:
 *   COMMUNE_ID=cocody DATABASE_URL=postgresql://... node scripts/seed-commune.js
 *
 * Variables optionnelles:
 *   COMMUNE_NOM="Mairie de Cocody"
 *   COMMUNE_APP="CiviCI"
 *   ADMIN_EMAIL="admin@mairie-cocody.ci"
 *   ADMIN_PASSWORD="MonMotDePasse123!"
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const COMMUNE_ID  = process.env.COMMUNE_ID;
const NOM         = process.env.COMMUNE_NOM      || `Mairie de ${COMMUNE_ID}`;
const NOM_APP     = process.env.COMMUNE_APP       || 'DigiCommune';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL       || `admin@${COMMUNE_ID}.ci`;
const ADMIN_PASS  = process.env.ADMIN_PASSWORD    || 'DigiCommune2025!';

if (!COMMUNE_ID) {
	console.error('❌  Variable COMMUNE_ID manquante.');
	process.exit(1);
}

const DEFAULT_SETTINGS = {
	agent:       { sla_heures: 48, notifications: { nouvelle_demande: true, escalade_resolue: true, reassignation: true } },
	superviseur: { seuil_escalades_alerte: 3, notifications: { nouvelle_escalade: true } },
	maire:       { periode_dashboard: 'mois', notifications: { cas_critique: true } },
	rdv: {
		jours_ouvrables: [1, 2, 3, 4, 5],
		heure_debut: '08:00', heure_fin: '16:00',
		duree_creneau: 30, max_rdv_par_creneau: 3,
		delai_min_jours: 1, delai_max_jours: 30, lieu: 'Mairie'
	},
	global: {
		modules: {
			naissance: true, mariage: true, deces: true,
			attestation_concubinage: true, attestation_domicile: true,
			certification_documents: true, legalisation: true,
			inscription_livret: true, duplicata_livret: true,
			certificat_vie_entretien: true, certificat_vie_adulte: true,
			fiche_familiale: true, fiche_individuelle: true, rdv: true
		},
		locked_params: [],
		frais_copie: 500, frais_copie_integrale: 2500, frais_urgence: 1500, frais_fixes: {},
		sla_heures_defaut: 48, max_pieces_jointes: 5,
		whatsapp_actif: false,
		langue: 'fr', timezone: 'Africa/Abidjan', format_date: 'dd/mm/yyyy',
		securite_session_heures: 8, theme: 'light', animations: true, taille_police: 'normal'
	}
};

async function main() {
	console.log(`\n🌱  Seed commune : ${COMMUNE_ID}`);

	// Commune
	await prisma.commune.upsert({
		where:  { id: COMMUNE_ID },
		update: {},
		create: {
			id:              COMMUNE_ID,
			nom:             NOM,
			nom_app:         NOM_APP,
			couleur_primaire: '#009A44'
		}
	});
	console.log(`✅  Commune "${COMMUNE_ID}" créée.`);

	// Settings
	await prisma.settings.upsert({
		where:  { commune_id: COMMUNE_ID },
		update: {},
		create: { commune_id: COMMUNE_ID, data: DEFAULT_SETTINGS }
	});
	console.log('✅  Settings par défaut créés.');

	// Superadmin
	const hash = await bcrypt.hash(ADMIN_PASS, 12);
	const existing = await prisma.utilisateur.findFirst({
		where: { commune_id: COMMUNE_ID, email: ADMIN_EMAIL }
	});

	if (!existing) {
		await prisma.utilisateur.create({
			data: {
				commune_id:    COMMUNE_ID,
				nom:           'Administrateur',
				prenom:        'Système',
				role:          'superadmin',
				email:         ADMIN_EMAIL,
				avatar:        'SA',
				actif:         true,
				password_hash: hash
			}
		});
		console.log(`✅  Superadmin créé : ${ADMIN_EMAIL} / "${ADMIN_PASS}"`);
	} else {
		console.log(`ℹ️   Superadmin "${ADMIN_EMAIL}" déjà existant, ignoré.`);
	}

	console.log('\n✨  Seed terminé !');
	console.log(`\n🔑  Connexion :  ${ADMIN_EMAIL}  /  ${ADMIN_PASS}`);
	console.log('    → Changer le mot de passe après la première connexion !\n');
}

main()
	.catch(err => { console.error('❌', err); process.exit(1); })
	.finally(() => prisma.$disconnect());
