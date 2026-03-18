import { json } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import { readSettings, writeSettings, readUsers, createUser, updateUser, deleteUser, readDemandes, appendSecurityLog } from '$lib/server/data.js';
import { createNotification } from '$lib/server/notifications.js';

/** GET /api/admin → stats système + config globale + utilisateurs */
export async function GET() {
	const settings = await readSettings();
	const users    = await readUsers();
	const demandes = await readDemandes();

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
	const settings = await readSettings();
	const users    = await readUsers();

	switch (body.action) {

		case 'toggle_module': {
			if (!settings.global) settings.global = { modules: {}, locked_params: [] };
			const prev = settings.global.modules[body.module];
			settings.global.modules[body.module] = !prev;
			await writeSettings(settings);
			await appendSecurityLog('module_toggle', 'superadmin', {
				module:  body.module,
				enabled: !prev
			});
			return json({ ok: true, enabled: settings.global.modules[body.module] });
		}

		case 'save_global': {
			settings.global = { ...settings.global, ...body.data };
			await writeSettings(settings);
			await appendSecurityLog('settings_change', 'superadmin', { champs: Object.keys(body.data) });
			return json({ ok: true });
		}

		case 'save_role_settings': {
			settings[body.role] = { ...settings[body.role], ...body.data };
			await writeSettings(settings);
			await appendSecurityLog('role_settings_change', 'superadmin', {
				role:   body.role,
				champs: Object.keys(body.data)
			});
			return json({ ok: true });
		}

		case 'save_rdv_settings': {
			settings.rdv = { ...settings.rdv, ...body.data };
			await writeSettings(settings);
			await appendSecurityLog('rdv_settings_change', 'superadmin', { champs: Object.keys(body.data) });
			return json({ ok: true });
		}

		case 'lock_param': {
			if (!settings.global.locked_params.includes(body.param)) {
				settings.global.locked_params.push(body.param);
				await writeSettings(settings);
				await appendSecurityLog('param_lock', 'superadmin', { param: body.param });
			}
			return json({ ok: true });
		}

		case 'unlock_param': {
			settings.global.locked_params = settings.global.locked_params.filter(p => p !== body.param);
			await writeSettings(settings);
			await appendSecurityLog('param_unlock', 'superadmin', { param: body.param });
			return json({ ok: true });
		}

		case 'add_user': {
			const { role, user } = body;
			const default_password = `Commune${new Date().getFullYear()}!`;
			const password_hash    = await bcrypt.hash(default_password, 12);
			const newUser = await createUser({
				...user,
				id:     `${role}_${Date.now()}`,
				role,
				actif:  true,
				avatar: (user.prenom[0] + user.nom[0]).toUpperCase(),
				password_hash
			});
			await appendSecurityLog('user_add', 'superadmin', {
				role,
				nom:   `${user.prenom} ${user.nom}`,
				email: user.email
			});
			await createNotification(role, 'bienvenue', `Bienvenue ${user.prenom} ${user.nom} ! Votre compte ${role} a été créé.`, null);
			return json({ ok: true, user: newUser, default_password });
		}

		case 'toggle_user': {
			const { userId, role } = body;
			let toggled = null;
			if (role === 'agent') {
				toggled = users.agents.find(a => a.id === userId);
			} else if (role === 'superviseur') {
				toggled = users.superviseurs.find(s => s.id === userId);
			} else if (role === 'maire' && users.maire?.id === userId) {
				toggled = users.maire;
			}
			if (toggled) {
				await updateUser(userId, { actif: !toggled.actif });
				await appendSecurityLog('user_toggle', 'superadmin', { userId, role, nom: `${toggled.prenom} ${toggled.nom}`, actif: !toggled.actif });
			}
			return json({ ok: true });
		}

		case 'update_user': {
			const { userId, role, data } = body;
			await updateUser(userId, data);
			await appendSecurityLog('user_update', 'superadmin', { userId, role, champs: Object.keys(data) });
			return json({ ok: true });
		}

		case 'delete_user': {
			const { userId, role } = body;
			const allUsers = await readUsers();
			let target = null;
			if (role === 'agent')       target = allUsers.agents.find(a => a.id === userId);
			else if (role === 'superviseur') target = allUsers.superviseurs.find(s => s.id === userId);
			else if (role === 'maire')  target = allUsers.maire?.id === userId ? allUsers.maire : null;
			if (!target) return json({ error: 'Utilisateur introuvable' }, { status: 404 });
			await deleteUser(userId);
			await appendSecurityLog('user_delete', 'superadmin', {
				userId, role,
				nom: `${target.prenom} ${target.nom}`,
				email: target.email
			});
			return json({ ok: true });
		}

		case 'reset_password': {
			const { userId, role } = body;
			const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
			const newPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
			const password_hash = await bcrypt.hash(newPassword, 12);
			await updateUser(userId, { password_hash });
			await appendSecurityLog('password_reset', 'superadmin', { userId, role });
			return json({ ok: true, new_password: newPassword });
		}

		default:
			return json({ error: 'Action inconnue' }, { status: 400 });
	}
}
