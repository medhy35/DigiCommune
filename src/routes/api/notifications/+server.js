import { json } from '@sveltejs/kit';
import { readNotifications, writeNotifications } from '$lib/server/data.js';
import { createNotification } from '$lib/server/notifications.js';

/** GET /api/notifications?role=agent */
export function GET({ url }) {
	const role = url.searchParams.get('role');
	const all  = readNotifications();
	const result = role ? all.filter(n => n.role === role) : all;
	return json(result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
}

/** POST /api/notifications */
export async function POST({ request }) {
	const body = await request.json();
	createNotification(body.role, body.type || 'info', body.message, body.demande_id || null);
	return json({ ok: true }, { status: 201 });
}
