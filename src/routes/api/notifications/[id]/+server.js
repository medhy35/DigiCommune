import { json, error } from '@sveltejs/kit';
import { markNotificationRead, deleteNotification } from '$lib/server/data.js';

/** PATCH /api/notifications/:id  → { read: true } pour marquer comme lue */
export async function PATCH({ params }) {
	const updated = await markNotificationRead(params.id);
	if (!updated) throw error(404, 'Notification non trouvée');
	return json(updated);
}

/** DELETE /api/notifications/:id → supprime la notification */
export async function DELETE({ params }) {
	await deleteNotification(params.id);
	return json({ ok: true });
}
