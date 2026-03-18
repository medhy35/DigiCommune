import { json } from '@sveltejs/kit';
import { readSettings, writeSettings, readUsers, appendSecurityLog } from '$lib/server/data.js';

/** GET /api/settings?role=agent */
export async function GET({ url }) {
	const role     = url.searchParams.get('role');
	const settings = await readSettings();
	const users    = await readUsers();

	let profil = null;
	if (role === 'agent')            profil = users.agents[0];
	else if (role === 'superviseur') profil = users.superviseurs[0];
	else if (role === 'maire')       profil = users.maire;

	const locked_params = settings.global?.locked_params || [];
	return json({ settings: role ? settings[role] : settings, profil, locked_params });
}

/** PUT /api/settings */
export async function PUT({ request }) {
	const { role, settings: newSettings } = await request.json();
	const all = await readSettings();
	all[role] = { ...all[role], ...newSettings };
	await writeSettings(all);
	await appendSecurityLog('role_settings_change', role, { champs: Object.keys(newSettings) });
	return json({ ok: true });
}
