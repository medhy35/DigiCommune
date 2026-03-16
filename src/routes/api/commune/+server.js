import { json } from '@sveltejs/kit';
import { readCommune, writeCommune, appendSecurityLog } from '$lib/server/data.js';

export function GET() {
	return json(readCommune());
}

export async function PUT({ request }) {
	const data    = await request.json();
	const updated = { ...readCommune(), ...data };
	writeCommune(updated);
	appendSecurityLog('identite_change', 'superadmin', { champs: Object.keys(data) });
	return json({ ok: true, commune: updated });
}
