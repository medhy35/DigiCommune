/**
 * Couche d'accès aux données — Prisma + PostgreSQL.
 * Toutes les routes API importent depuis ici.
 * Chaque déploiement correspond à une commune (COMMUNE_ID dans .env).
 */
import { prisma, getCommuneId } from './db.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function omit(obj, keys) {
	const out = { ...obj };
	for (const k of keys) delete out[k];
	return out;
}

function sanitizeUser(u) {
	return omit(u, ['password_hash']);
}

// ── Commune ────────────────────────────────────────────────────────────────

export async function readCommune() {
	const id = getCommuneId();
	const c  = await prisma.commune.findUnique({ where: { id } });
	if (!c) throw new Error(`Commune "${id}" non trouvée en base.`);
	return c;
}

export async function writeCommune(data) {
	const id = getCommuneId();
	const { created_at, updated_at, utilisateurs, demandes, notifications, rendez_vous, security_logs, templates, settings, sessions, ...fields } = data;
	return prisma.commune.update({ where: { id }, data: fields });
}

// ── Utilisateurs ────────────────────────────────────────────────────────────

export async function readUsers() {
	const commune_id = getCommuneId();
	const tous = await prisma.utilisateur.findMany({
		where:   { commune_id },
		orderBy: { created_at: 'asc' }
	});
	const sanitized = tous.map(sanitizeUser);
	return {
		agents:      sanitized.filter(u => u.role === 'agent'),
		superviseurs: sanitized.filter(u => u.role === 'superviseur'),
		maire:       sanitized.find(u => u.role === 'maire') ?? null,
		superadmin:  sanitized.find(u => u.role === 'superadmin') ?? null
	};
}

export async function readUserById(id) {
	const commune_id = getCommuneId();
	const u = await prisma.utilisateur.findFirst({ where: { id, commune_id } });
	return u ? sanitizeUser(u) : null;
}

/** Résout le nom complet d'un utilisateur à partir de son id. */
export async function resolveUserName(userId) {
	if (!userId) return userId;
	const commune_id = getCommuneId();
	const u = await prisma.utilisateur.findFirst({
		where:  { id: userId, commune_id },
		select: { prenom: true, nom: true }
	});
	return u ? `${u.prenom} ${u.nom}` : userId;
}

/** Créer un utilisateur (avec password_hash déjà hashé). */
export async function createUser(data) {
	const commune_id = getCommuneId();
	const user = await prisma.utilisateur.create({
		data: { ...data, commune_id }
	});
	return sanitizeUser(user);
}

export async function updateUser(id, data) {
	const commune_id = getCommuneId();
	const user = await prisma.utilisateur.update({
		where: { id },
		data:  { ...data, commune_id }
	});
	return sanitizeUser(user);
}

// ── Demandes ────────────────────────────────────────────────────────────────

export async function readDemandes(filters = {}) {
	const commune_id = getCommuneId();
	const where = { commune_id };

	if (filters.statut)         where.statut    = filters.statut;
	if (filters.type_acte)      where.type_acte = filters.type_acte;
	if (filters.agent_id)       where.agent_id  = filters.agent_id;

	const demandes = await prisma.demande.findMany({
		where,
		orderBy: { created_at: 'desc' }
	});

	// Filtre escalade_level (champ JSONB, pas possible en WHERE simple)
	if (filters.escalade_level) {
		return demandes.filter(d => {
			const e = d.escalade;
			return e && e.level === filters.escalade_level && !e.resolu;
		});
	}

	return demandes;
}

export async function readDemande(id) {
	const commune_id = getCommuneId();
	return prisma.demande.findFirst({ where: { id, commune_id } });
}

export async function createDemande(data) {
	const commune_id = getCommuneId();
	return prisma.demande.create({ data: { ...data, commune_id } });
}

export async function updateDemande(id, data) {
	const commune_id = getCommuneId();
	// Retirer les champs de relation Prisma s'ils sont présents
	const { commune, ...fields } = data;
	return prisma.demande.update({
		where: { id, commune_id },
		data:  { ...fields, updated_at: new Date() }
	});
}

/** Compte les demandes par agent_id (pour load-balancing à la création). */
export async function countDemandesParAgent(agentIds) {
	const commune_id = getCommuneId();
	const counts = await prisma.demande.groupBy({
		by:     ['agent_id'],
		where:  { commune_id, agent_id: { in: agentIds } },
		_count: { _all: true }
	});
	const map = Object.fromEntries(agentIds.map(id => [id, 0]));
	for (const c of counts) if (c.agent_id) map[c.agent_id] = c._count._all;
	return map;
}

// ── Notifications ────────────────────────────────────────────────────────────

export async function readNotifications(role) {
	const commune_id = getCommuneId();
	const where = { commune_id };
	if (role) where.role = role;
	return prisma.notification.findMany({
		where,
		orderBy: { created_at: 'desc' }
	});
}

export async function createNotification(role, type, message, demande_id) {
	const commune_id = getCommuneId();
	return prisma.notification.create({
		data: { commune_id, role, type, message, demande_id: demande_id ?? null }
	});
}

export async function markNotificationRead(id) {
	return prisma.notification.update({ where: { id }, data: { read: true } });
}

export async function deleteNotification(id) {
	return prisma.notification.delete({ where: { id } });
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function readSettings() {
	const commune_id = getCommuneId();
	const row = await prisma.settings.findUnique({ where: { commune_id } });
	return row?.data ?? defaultSettings();
}

export async function writeSettings(data) {
	const commune_id = getCommuneId();
	return prisma.settings.upsert({
		where:  { commune_id },
		update: { data },
		create: { commune_id, data }
	});
}

function defaultSettings() {
	return {
		agent:       { sla_heures: 48, notifications: { nouvelle_demande: true, escalade_resolue: true, reassignation: true } },
		superviseur: { seuil_escalades_alerte: 3, notifications: { nouvelle_escalade: true } },
		maire:       { periode_dashboard: 'mois', notifications: { cas_critique: true } },
		rdv: {
			jours_ouvrables: [1, 2, 3, 4, 5],
			heure_debut:     '08:00',
			heure_fin:       '16:00',
			duree_creneau:   30,
			max_rdv_par_creneau: 3,
			delai_min_jours: 1,
			delai_max_jours: 30,
			lieu:            'Mairie'
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
			locked_params:                 [],
			frais_copie:                   500,
			frais_copie_integrale:         2500,
			frais_urgence:                 1500,
			frais_fixes:                   {},
			sla_heures_defaut:             48,
			delai_declaration_naissance_jours: 90,
			delai_declaration_deces_jours: 15,
			max_pieces_jointes:            5,
			whatsapp_actif:                true,
			langue:                        'fr',
			timezone:                      'Africa/Abidjan',
			format_date:                   'dd/mm/yyyy',
			securite_session_heures:       8,
			theme:                         'light',
			animations:                    true,
			taille_police:                 'normal'
		}
	};
}

// ── Journal de sécurité ──────────────────────────────────────────────────────

export async function readSecurityLog(filters = {}) {
	const commune_id = getCommuneId();
	const where = { commune_id };
	if (filters.type)   where.type   = filters.type;
	if (filters.acteur) where.acteur = filters.acteur;
	if (filters.from || filters.to) {
		where.date = {};
		if (filters.from) where.date.gte = new Date(filters.from);
		if (filters.to)   where.date.lte = new Date(filters.to + 'T23:59:59');
	}
	const limit = Math.min(filters.limit || 500, 2000);
	return prisma.securityLog.findMany({
		where,
		orderBy: { date: 'desc' },
		take:    limit
	});
}

export async function appendSecurityLog(type, acteur, details = {}) {
	const commune_id = getCommuneId();
	return prisma.securityLog.create({
		data: { commune_id, type, acteur, details }
	});
}

export async function batchSecurityLog(entries) {
	if (!entries.length) return;
	const commune_id = getCommuneId();
	const now = new Date();
	return prisma.securityLog.createMany({
		data: entries.map(({ type, acteur, details = {} }) => ({
			commune_id, type, acteur, details, date: now
		}))
	});
}

export async function clearSecurityLog() {
	const commune_id = getCommuneId();
	return prisma.securityLog.deleteMany({ where: { commune_id } });
}

// ── Codes de vérification ────────────────────────────────────────────────────
// Stockés dans le JSONB verification_codes de la demande.

export async function lookupVerifCode(code) {
	const commune_id = getCommuneId();
	// Cherche dans les 3 types possibles
	const demande = await prisma.demande.findFirst({
		where: {
			commune_id,
			OR: [
				{ verification_codes: { path: ['attestation'], equals: code } },
				{ verification_codes: { path: ['recu'],        equals: code } },
				{ verification_codes: { path: ['acte'],        equals: code } }
			]
		},
		select: { id: true, verification_codes: true }
	});
	if (!demande) return null;
	const vc = demande.verification_codes;
	const type = vc.attestation === code ? 'attestation' : vc.recu === code ? 'recu' : 'acte';
	return { demande_id: demande.id, type };
}

// ── Rendez-vous ──────────────────────────────────────────────────────────────

export async function readRendezVous(filters = {}) {
	const commune_id = getCommuneId();
	const where = { commune_id };
	if (filters.demande_id) where.demande_id = filters.demande_id;
	if (filters.statut)     where.statut     = filters.statut;
	if (filters.date_rdv)   where.date_rdv   = filters.date_rdv;
	return prisma.rendezVous.findMany({
		where,
		orderBy: [{ date_rdv: 'asc' }, { heure_rdv: 'asc' }]
	});
}

export async function createRendezVous(data) {
	const commune_id = getCommuneId();
	return prisma.rendezVous.create({ data: { ...data, commune_id } });
}

export async function updateRendezVous(id, data) {
	const commune_id = getCommuneId();
	return prisma.rendezVous.update({
		where: { id },
		data:  { ...data, updated_at: new Date() }
	});
}

export async function countRendezVousCreneau(date_rdv, heure_rdv) {
	const commune_id = getCommuneId();
	return prisma.rendezVous.count({
		where: { commune_id, date_rdv, heure_rdv, statut: { not: 'annule' } }
	});
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function readTemplates() {
	const commune_id = getCommuneId();
	const rows = await prisma.template.findMany({ where: { commune_id } });
	// Retourne un objet { type_acte: { nom_fichier, ... } } pour compat
	const out = {};
	for (const t of rows) {
		const { id, commune_id: _cid, type, ...rest } = t;
		out[type] = rest;
	}
	return out;
}

export async function upsertTemplate(type, data) {
	const commune_id = getCommuneId();
	return prisma.template.upsert({
		where:  { commune_id_type: { commune_id, type } },
		update: data,
		create: { ...data, commune_id, type }
	});
}

export async function deleteTemplate(type) {
	const commune_id = getCommuneId();
	return prisma.template.deleteMany({ where: { commune_id, type } });
}

// ── Sessions ────────────────────────────────────────────────────────────────

export async function createSession(utilisateur_id, heures = 8) {
	const commune_id = getCommuneId();
	const expires_at = new Date(Date.now() + heures * 3600 * 1000);
	return prisma.session.create({
		data: { utilisateur_id, commune_id, expires_at }
	});
}

export async function getSession(id) {
	const commune_id = getCommuneId();
	return prisma.session.findFirst({
		where: { id, commune_id, expires_at: { gt: new Date() } },
		include: { utilisateur: { select: { id: true, nom: true, prenom: true, role: true, email: true, avatar: true, actif: true } } }
	});
}

export async function deleteSession(id) {
	return prisma.session.deleteMany({ where: { id } });
}

export async function deleteUserSessions(utilisateur_id) {
	const commune_id = getCommuneId();
	return prisma.session.deleteMany({ where: { utilisateur_id, commune_id } });
}

export async function cleanExpiredSessions() {
	return prisma.session.deleteMany({ where: { expires_at: { lt: new Date() } } });
}
