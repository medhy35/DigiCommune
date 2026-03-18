import { json } from '@sveltejs/kit';
import { readCommune, writeCommune, appendSecurityLog } from '$lib/server/data.js';

export async function GET() {
	return json(await readCommune());
}

export async function PUT({ request }) {
	const data    = await request.json();
	const current = await readCommune();
	const updated = { ...current, ...data };
	await writeCommune(updated);
	await appendSecurityLog('identite_change', 'superadmin', { champs: Object.keys(data) });
	return json({ ok: true, commune: updated });
}
