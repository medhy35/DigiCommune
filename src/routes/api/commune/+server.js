import { json } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');

export function GET() {
	const commune = JSON.parse(readFileSync(join(DATA_DIR, 'commune.json'), 'utf-8'));
	return json(commune);
}
