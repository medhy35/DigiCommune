/**
 * Couche d'accès aux données — centralise tout l'I/O sur les fichiers JSON.
 * Toutes les routes API importent depuis ici, jamais directement depuis 'fs'.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DIR = join(process.cwd(), 'data');

function readJSON(file) {
	return JSON.parse(readFileSync(join(DIR, file), 'utf-8'));
}

function writeJSON(file, data) {
	writeFileSync(join(DIR, file), JSON.stringify(data, null, 2), 'utf-8');
}

// ── Demandes ─────────────────────────────────────────────────────────
export const readDemandes  = () => readJSON('demandes.json');
export const writeDemandes = (d) => writeJSON('demandes.json', d);

// ── Utilisateurs ──────────────────────────────────────────────────────
export const readUsers  = () => readJSON('utilisateurs.json');
export const writeUsers = (u) => writeJSON('utilisateurs.json', u);

// ── Settings ──────────────────────────────────────────────────────────
export const readSettings  = () => readJSON('settings.json');
export const writeSettings = (s) => writeJSON('settings.json', s);

// ── Commune ───────────────────────────────────────────────────────────
export const readCommune  = () => readJSON('commune.json');
export const writeCommune = (c) => writeJSON('commune.json', c);

// ── Notifications ─────────────────────────────────────────────────────
export function readNotifications() {
	try { return readJSON('notifications.json'); } catch { return []; }
}
export const writeNotifications = (n) => writeJSON('notifications.json', n);

// ── Templates ─────────────────────────────────────────────────────────
export function readTemplates() {
	try { return readJSON('templates.json'); } catch { return {}; }
}
export const writeTemplates = (t) => writeJSON('templates.json', t);

// ── Journal de sécurité ───────────────────────────────────────────────
export function readSecurityLog() {
	try { return readJSON('security_log.json'); } catch { return []; }
}
export const writeSecurityLog = (entries) => writeJSON('security_log.json', entries);

/**
 * Ajoute une entrée dans le journal de sécurité.
 * @param {string} type     - Type d'événement (connexion, deconnexion, module_toggle, …)
 * @param {string} acteur   - Rôle ou identifiant de l'auteur
 * @param {object} details  - Données spécifiques à l'événement
 */
export function appendSecurityLog(type, acteur, details = {}) {
	const log = readSecurityLog();
	log.unshift({
		id:     `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
		date:   new Date().toISOString(),
		type,
		acteur,
		details
	});
	// Garder les 2000 dernières entrées pour éviter une croissance illimitée
	writeSecurityLog(log.slice(0, 2000));
}

/**
 * Ajoute plusieurs entrées dans le journal de sécurité en une seule lecture/écriture.
 * À utiliser quand un seul handler génère plusieurs événements.
 * @param {{ type: string, acteur: string, details?: object }[]} entries
 */
export function batchSecurityLog(entries) {
	if (!entries.length) return;
	const log = readSecurityLog();
	const now = new Date().toISOString();
	// Insérer en ordre chronologique (le dernier de la liste = le plus récent)
	for (let i = entries.length - 1; i >= 0; i--) {
		const { type, acteur, details = {} } = entries[i];
		log.unshift({
			id:     `sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
			date:   now,
			type,
			acteur,
			details
		});
	}
	writeSecurityLog(log.slice(0, 2000));
}

// ── Codes de vérification ─────────────────────────────────────────────
export function readVerifCodes() {
	try { return readJSON('verification_codes.json'); } catch { return {}; }
}
export const writeVerifCodes = (v) => writeJSON('verification_codes.json', v);

// ── Rendez-vous ───────────────────────────────────────────────────────
export function readRendezVous() {
	try { return readJSON('rendez_vous.json'); } catch { return []; }
}
export const writeRendezVous = (r) => writeJSON('rendez_vous.json', r);
