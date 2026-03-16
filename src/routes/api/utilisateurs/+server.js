import { json } from '@sveltejs/kit';
import { readUsers } from '$lib/server/data.js';

export function GET() {
	return json(readUsers());
}
