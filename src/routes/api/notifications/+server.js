import { json } from '@sveltejs/kit';
import { readNotifications, createNotification } from '$lib/server/data.js';

/** GET /api/notifications?role=agent */
export async function GET({ url }) {
	const role   = url.searchParams.get('role');
	const result = await readNotifications(role);
	return json(result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
}

/** POST /api/notifications */
export async function POST({ request }) {
	const body = await request.json();
	await createNotification(body.role, body.type || 'info', body.message, body.demande_id || null);
	return json({ ok: true }, { status: 201 });
}
