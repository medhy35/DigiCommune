import { json } from '@sveltejs/kit';
import { readSettings, writeSettings, appendSecurityLog } from '$lib/server/data.js';

/** GET /api/settings?role=agent */
export async function GET({ url, locals }) {
	const role     = url.searchParams.get('role');
	const settings = await readSettings();

	const profil = locals.user ?? null;

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
