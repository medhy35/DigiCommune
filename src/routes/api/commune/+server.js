import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const COMMUNE_FILE = join(process.cwd(), 'data', 'commune.json');

export function GET() {
	const commune = JSON.parse(readFileSync(COMMUNE_FILE, 'utf-8'));
	return json(commune);
}

export async function PUT({ request }) {
	const data = await request.json();
	const commune = JSON.parse(readFileSync(COMMUNE_FILE, 'utf-8'));
	const updated = { ...commune, ...data };
	writeFileSync(COMMUNE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
	return json({ ok: true, commune: updated });
}
