import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_FILE = join(process.cwd(), 'data', 'notifications.json');

export function readNotifications() {
	try {
		return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
	} catch {
		return [];
	}
}

export function writeNotifications(notifications) {
	writeFileSync(DATA_FILE, JSON.stringify(notifications, null, 2), 'utf-8');
}

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
