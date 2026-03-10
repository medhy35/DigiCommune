import { json, error } from '@sveltejs/kit';
import { readNotifications, writeNotifications } from '$lib/server/notifications.js';

/** PATCH /api/notifications/:id  → { read: true } pour marquer comme lue */
export async function PATCH({ params, request }) {
	const body = await request.json();
	const all = readNotifications();
	const index = all.findIndex(n => n.id === params.id);
	if (index === -1) throw error(404, 'Notification non trouvée');
	all[index] = { ...all[index], ...body };
	writeNotifications(all);
	return json(all[index]);
}
