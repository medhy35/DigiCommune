import { readNotifications, writeNotifications } from '$lib/server/data.js';

export { readNotifications, writeNotifications };

export function createNotification(role, type, message, demande_id) {
	const all = readNotifications();
	const maxNum = all
		.map(n => parseInt(n.id.replace('notif_', '') || '0'))
		.reduce((a, b) => Math.max(a, b), 0);
	all.push({
		id: `notif_${String(maxNum + 1).padStart(3, '0')}`,
		role, type, message, demande_id,
		read: false,
		created_at: new Date().toISOString()
	});
	writeNotifications(all);
}
