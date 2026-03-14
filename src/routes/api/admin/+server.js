import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SETTINGS_FILE = join(process.cwd(), 'data', 'settings.json');
const UTILISATEURS_FILE = join(process.cwd(), 'data', 'utilisateurs.json');
const DEMANDES_FILE = join(process.cwd(), 'data', 'demandes.json');

function readSettings() { return JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')); }
function readUsers() { return JSON.parse(readFileSync(UTILISATEURS_FILE, 'utf-8')); }
function readDemandes() { return JSON.parse(readFileSync(DEMANDES_FILE, 'utf-8')); }
function writeSettings(data) { writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8'); }
function writeUsers(data) { writeFileSync(UTILISATEURS_FILE, JSON.stringify(data, null, 2), 'utf-8'); }

/** GET /api/admin  → stats système + config globale + utilisateurs */
export function GET() {
	const settings = readSettings();
	const users = readUsers();
	const demandes = readDemandes();

	// Calcul des stats globales
	const stats = {
		total: demandes.length,
		recues: demandes.filter(d => d.statut === 'recue').length,
		en_cours: demandes.filter(d => d.statut === 'en_cours').length,
		traitees: demandes.filter(d => d.statut === 'traitee' || d.statut === 'disponible').length,
		rejetees: demandes.filter(d => d.statut === 'rejetee').length,
		escaladees: demandes.filter(d => d.escalade && !d.escalade.resolu).length,
		agents_actifs: users.agents.filter(a => a.actif !== false).length,
		modules_actifs: Object.values(settings.global?.modules || {}).filter(Boolean).length
	};

	// Toutes les stats par type de service
	const par_type = {};
	for (const d of demandes) {
		par_type[d.type_acte] = (par_type[d.type_acte] || 0) + 1;
	}

	return json({ settings, users, stats, par_type });
}

/** POST /api/admin  → actions d'administration */
export async function POST({ request }) {
	const body = await request.json();
	const { action } = body;
	const settings = readSettings();
	const users = readUsers();

	// ── Modules ──────────────────────────────────────────────
	if (action === 'toggle_module') {
		const { module } = body;
		if (!settings.global) settings.global = { modules: {}, locked_params: [] };
		settings.global.modules[module] = !settings.global.modules[module];
		writeSettings(settings);
		return json({ ok: true, enabled: settings.global.modules[module] });
	}

	// ── Paramètres globaux ────────────────────────────────────
	if (action === 'save_global') {
		const { data } = body;
		settings.global = { ...settings.global, ...data };
		writeSettings(settings);
		return json({ ok: true });
	}

	// ── Paramètres par rôle ───────────────────────────────────
	if (action === 'save_role_settings') {
		const { role, data } = body;
		settings[role] = { ...settings[role], ...data };
		writeSettings(settings);
		return json({ ok: true });
	}

	// ── Verrouillage d'un paramètre ───────────────────────────
	if (action === 'lock_param') {
		const { param } = body;
		if (!settings.global.locked_params.includes(param)) {
			settings.global.locked_params.push(param);
			writeSettings(settings);
		}
		return json({ ok: true });
	}

	if (action === 'unlock_param') {
		const { param } = body;
		settings.global.locked_params = settings.global.locked_params.filter(p => p !== param);
		writeSettings(settings);
		return json({ ok: true });
	}

	// ── Gestion des utilisateurs ──────────────────────────────
	if (action === 'add_user') {
		const { role, user } = body;
		const id = `${role}_${Date.now()}`;
		const newUser = { ...user, id, role, actif: true, avatar: (user.prenom[0] + user.nom[0]).toUpperCase() };
		if (role === 'agent') users.agents.push(newUser);
		else if (role === 'superviseur') users.superviseurs.push(newUser);
		writeUsers(users);
		return json({ ok: true, user: newUser });
	}

	if (action === 'toggle_user') {
		const { userId, role } = body;
		if (role === 'agent') {
			const u = users.agents.find(a => a.id === userId);
			if (u) u.actif = !u.actif;
		} else if (role === 'superviseur') {
			const u = users.superviseurs.find(s => s.id === userId);
			if (u) u.actif = !u.actif;
		}
		writeUsers(users);
		return json({ ok: true });
	}

	if (action === 'update_user') {
		const { userId, role, data } = body;
		if (role === 'agent') {
			const idx = users.agents.findIndex(a => a.id === userId);
			if (idx !== -1) users.agents[idx] = { ...users.agents[idx], ...data };
		} else if (role === 'superviseur') {
			const idx = users.superviseurs.findIndex(s => s.id === userId);
			if (idx !== -1) users.superviseurs[idx] = { ...users.superviseurs[idx], ...data };
		} else if (role === 'maire') {
			users.maire = { ...users.maire, ...data };
		}
		writeUsers(users);
		return json({ ok: true });
	}

	return json({ error: 'Action inconnue' }, { status: 400 });
}
