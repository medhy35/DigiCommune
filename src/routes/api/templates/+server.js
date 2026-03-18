import { json, error } from '@sveltejs/kit';
import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { readTemplates, upsertTemplate, deleteTemplate, appendSecurityLog } from '$lib/server/data.js';
import { TYPE_ACTE_LABELS } from '$lib/utils/helpers.js';

const TEMPLATES_DIR = join(process.cwd(), 'data', 'templates');

/** GET /api/templates → liste des modèles avec statut */
export async function GET() {
	const meta = await readTemplates();
	const templates = Object.entries(TYPE_ACTE_LABELS).map(([key, label]) => {
		const t = meta[key];
		return {
			key,
			label,
			configured:  !!t,
			nom_fichier: t?.nom_fichier || null,
			taille:      t?.taille     || null,
			uploaded_at: t?.uploaded_at || null,
			uploaded_by: t?.uploaded_by || null
		};
	});
	return json(templates);
}

/** POST /api/templates — { type_acte, file (base64), nom_fichier, taille, uploaded_by } */
export async function POST({ request }) {
	const body = await request.json();
	const { type_acte, nom_fichier, taille, data } = body;

	if (!type_acte || !TYPE_ACTE_LABELS[type_acte]) throw error(400, 'Type d\'acte invalide');
	if (!nom_fichier) throw error(400, 'Nom de fichier manquant');

	const templateData = {
		nom_fichier,
		taille:      taille || 0,
		uploaded_at: new Date().toISOString(),
		uploaded_by: body.uploaded_by || 'superadmin',
		has_data:    !!data
	};

	if (data) {
		const ext      = nom_fichier.split('.').pop() || 'docx';
		const filePath = join(TEMPLATES_DIR, `${type_acte}.${ext}`);
		const buffer   = Buffer.from(data.split(',')[1] || data, 'base64');
		writeFileSync(filePath, buffer);
		templateData.file_path = filePath;
		templateData.ext       = ext;
	}

	await upsertTemplate(type_acte, templateData);
	await appendSecurityLog('template_upload', body.uploaded_by || 'superadmin', {
		type_acte,
		nom_fichier,
		taille: taille || 0
	});
	return json({ ok: true, type_acte, nom_fichier });
}

/** DELETE /api/templates?type=naissance */
export async function DELETE({ url }) {
	const type_acte = url.searchParams.get('type');
	if (!type_acte) throw error(400, 'Type manquant');

	const meta = await readTemplates();
	const t    = meta[type_acte];
	if (t?.file_path && existsSync(t.file_path)) {
		try { unlinkSync(t.file_path); } catch {}
	}
	await deleteTemplate(type_acte);
	await appendSecurityLog('template_delete', 'superadmin', {
		type_acte,
		nom_fichier: t?.nom_fichier || ''
	});
	return json({ ok: true });
}
