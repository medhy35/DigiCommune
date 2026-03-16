import { json } from '@sveltejs/kit';
import { readSettings, writeSettings, readUsers, writeUsers, readDemandes, appendSecurityLog } from '$lib/server/data.js';

/** GET /api/admin → stats système + config globale + utilisateurs */
export function GET() {
	const settings = readSettings();
	const users    = readUsers();
	const demandes = readDemandes();

	const stats = {
		total:        demandes.length,
		recues:       demandes.filter(d => d.statut === 'recue').length,
		en_cours:     demandes.filter(d => d.statut === 'en_cours').length,
		traitees:     demandes.filter(d => d.statut === 'traitee' || d.statut === 'disponible').length,
		rejetees:     demandes.filter(d => d.statut === 'rejetee').length,
		escaladees:   demandes.filter(d => d.escalade && !d.escalade.resolu).length,
		agents_actifs: users.agents.filter(a => a.actif !== false).length,
		modules_actifs: Object.values(settings.global?.modules || {}).filter(Boolean).length
	};

	const par_type = {};
	for (const d of demandes) par_type[d.type_acte] = (par_type[d.type_acte] || 0) + 1;

	return json({ settings, users, stats, par_type });
}

/** POST /api/admin → actions d'administration */
export async function POST({ request }) {
	const body     = await request.json();
	const settings = readSettings();
	const users    = readUsers();

	switch (body.action) {

		case 'toggle_module': {
			if (!settings.global) settings.global = { modules: {}, locked_params: [] };
			const prev = settings.global.modules[body.module];
			settings.global.modules[body.module] = !prev;
			writeSettings(settings);
			appendSecurityLog('module_toggle', 'superadmin', {
				module:  body.module,
				enabled: !prev
			});
			return json({ ok: true, enabled: settings.global.modules[body.module] });
		}

		case 'save_global': {
			settings.global = { ...settings.global, ...body.data };
			writeSettings(settings);
			appendSecurityLog('settings_change', 'superadmin', { champs: Object.keys(body.data) });
			return json({ ok: true });
		}

		case 'save_role_settings': {
			settings[body.role] = { ...settings[body.role], ...body.data };
			writeSettings(settings);
			appendSecurityLog('role_settings_change', 'superadmin', {
				role:   body.role,
				champs: Object.keys(body.data)
			});
			return json({ ok: true });
		}

		case 'lock_param': {
			if (!settings.global.locked_params.includes(body.param)) {
				settings.global.locked_params.push(body.param);
				writeSettings(settings);
				appendSecurityLog('param_lock', 'superadmin', { param: body.param });
			}
			return json({ ok: true });
		}

		case 'unlock_param': {
			settings.global.locked_params = settings.global.locked_params.filter(p => p !== body.param);
			writeSettings(settings);
			appendSecurityLog('param_unlock', 'superadmin', { param: body.param });
			return json({ ok: true });
		}

		case 'add_user': {
			const { role, user } = body;
			const newUser = { ...user, id: `${role}_${Date.now()}`, role, actif: true, avatar: (user.prenom[0] + user.nom[0]).toUpperCase() };
			if (role === 'agent')            users.agents.push(newUser);
			else if (role === 'superviseur') users.superviseurs.push(newUser);
			else if (role === 'maire')       users.maire = newUser;
			writeUsers(users);
			appendSecurityLog('user_add', 'superadmin', {
				role,
				nom:   `${user.prenom} ${user.nom}`,
				email: user.email
			});
			return json({ ok: true, user: newUser });
		}

		case 'toggle_user': {
			const { userId, role } = body;
			let toggled = null;
			if (role === 'agent') {
				toggled = users.agents.find(a => a.id === userId);
				if (toggled) toggled.actif = !toggled.actif;
			} else if (role === 'superviseur') {
				toggled = users.superviseurs.find(s => s.id === userId);
				if (toggled) toggled.actif = !toggled.actif;
			} else if (role === 'maire' && users.maire?.id === userId) {
				users.maire.actif = !users.maire.actif;
				toggled = users.maire;
			}
			if (toggled) {
				writeUsers(users);
				appendSecurityLog('user_toggle', 'superadmin', { userId, role, nom: `${toggled.prenom} ${toggled.nom}`, actif: toggled.actif });
			}
			return json({ ok: true });
		}

		case 'update_user': {
			const { userId, role, data } = body;
			if (role === 'agent') {
				const i = users.agents.findIndex(a => a.id === userId);
				if (i !== -1) { users.agents[i] = { ...users.agents[i], ...data }; }
			} else if (role === 'superviseur') {
				const i = users.superviseurs.findIndex(s => s.id === userId);
				if (i !== -1) { users.superviseurs[i] = { ...users.superviseurs[i], ...data }; }
			} else if (role === 'maire') {
				users.maire = { ...users.maire, ...data };
			}
			writeUsers(users);
			appendSecurityLog('user_update', 'superadmin', { userId, role, champs: Object.keys(data) });
			return json({ ok: true });
		}

		default:
			return json({ error: 'Action inconnue' }, { status: 400 });
	}
}
