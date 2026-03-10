import { json } from '@sveltejs/kit';
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

/** GET /api/notifications?role=agent  → liste triée par date desc */
export function GET({ url }) {
	const role = url.searchParams.get('role');
	const all = readNotifications();
	const result = role ? all.filter(n => n.role === role) : all;
	return json(result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
}

/** POST /api/notifications  → crée une nouvelle notification */
export async function POST({ request }) {
	const body = await request.json();
	const all = readNotifications();
	const maxNum = all
		.map(n => parseInt(n.id.replace('notif_', '') || '0'))
		.reduce((a, b) => Math.max(a, b), 0);
	const newNotif = {
		id: `notif_${String(maxNum + 1).padStart(3, '0')}`,
		role: body.role,
		type: body.type || 'info',
		message: body.message,
		demande_id: body.demande_id || null,
		read: false,
		created_at: new Date().toISOString()
	};
	all.push(newNotif);
	writeNotifications(all);
	return json(newNotif, { status: 201 });
}
