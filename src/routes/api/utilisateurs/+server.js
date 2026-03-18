import { json } from '@sveltejs/kit';
import { readUsers } from '$lib/server/data.js';

export async function GET() {
	return json(await readUsers());
}
