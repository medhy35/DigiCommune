import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SETTINGS_FILE = join(process.cwd(), 'data', 'settings.json');
const UTILISATEURS_FILE = join(process.cwd(), 'data', 'utilisateurs.json');

function readSettings() {
	return JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'));
}

/** GET /api/settings?role=agent  → { settings, profil } */
export function GET({ url }) {
	const role = url.searchParams.get('role');
	const settings = readSettings();
	const utilisateurs = JSON.parse(readFileSync(UTILISATEURS_FILE, 'utf-8'));

	let profil = null;
	if (role === 'agent') profil = utilisateurs.agents[0];
	else if (role === 'superviseur') profil = utilisateurs.superviseurs[0];
	else if (role === 'maire') profil = utilisateurs.maire;

	return json({ settings: role ? settings[role] : settings, profil });
}

/** PUT /api/settings  → { role, settings } */
export async function PUT({ request }) {
	const { role, settings: newSettings } = await request.json();
	const all = readSettings();
	all[role] = { ...all[role], ...newSettings };
	writeFileSync(SETTINGS_FILE, JSON.stringify(all, null, 2), 'utf-8');
	return json({ ok: true });
}
