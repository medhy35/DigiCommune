import { json, error } from '@sveltejs/kit';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const META_FILE = join(process.cwd(), 'data', 'templates.json');
const TEMPLATES_DIR = join(process.cwd(), 'data', 'templates');

const TYPE_LABELS = {
	naissance: 'Acte de naissance',
	mariage: 'Acte de mariage',
	deces: 'Acte de décès',
	attestation_concubinage: 'Attestation de concubinage',
	attestation_domicile: 'Attestation de domicile',
	certification_documents: 'Certification de documents',
	legalisation: 'Légalisation',
	inscription_livret: 'Inscription livret de famille',
	duplicata_livret: 'Duplicata livret de famille',
	certificat_vie_entretien: 'Certificat de vie d\'entretien',
	certificat_vie_adulte: 'Certificat de vie adulte',
	fiche_familiale: 'Fiche familiale de l\'état civil',
	fiche_individuelle: 'Fiche individuelle d\'état civil'
};

function readMeta() {
	try { return JSON.parse(readFileSync(META_FILE, 'utf-8')); }
	catch { return {}; }
}

function writeMeta(meta) {
	writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
}

/** GET /api/templates → list of templates with status */
export function GET() {
	const meta = readMeta();
	const templates = Object.entries(TYPE_LABELS).map(([key, label]) => {
		const t = meta[key];
		return {
			key,
			label,
			configured: !!t,
			nom_fichier: t?.nom_fichier || null,
			taille: t?.taille || null,
			uploaded_at: t?.uploaded_at || null,
			uploaded_by: t?.uploaded_by || null
		};
	});
	return json(templates);
}

/** POST /api/templates — multipart: { type_acte, file (base64), nom_fichier, taille } */
export async function POST({ request }) {
	const body = await request.json();
	const { type_acte, nom_fichier, taille, data } = body;

	if (!type_acte || !TYPE_LABELS[type_acte]) throw error(400, 'Type d\'acte invalide');
	if (!nom_fichier) throw error(400, 'Nom de fichier manquant');

	const meta = readMeta();
	meta[type_acte] = {
		nom_fichier,
		taille: taille || 0,
		uploaded_at: new Date().toISOString(),
		uploaded_by: body.uploaded_by || 'superadmin',
		// Store base64 data reference (for POC; in prod, save to disk/cloud)
		has_data: !!data
	};

	// Save file to disk if data provided (base64)
	if (data) {
		const ext = nom_fichier.split('.').pop() || 'docx';
		const filePath = join(TEMPLATES_DIR, `${type_acte}.${ext}`);
		const buffer = Buffer.from(data.split(',')[1] || data, 'base64');
		writeFileSync(filePath, buffer);
		meta[type_acte].file_path = filePath;
		meta[type_acte].ext = ext;
	}

	writeMeta(meta);
	return json({ ok: true, type_acte, nom_fichier });
}

/** DELETE /api/templates?type=naissance */
export function DELETE({ url }) {
	const type_acte = url.searchParams.get('type');
	if (!type_acte) throw error(400, 'Type manquant');

	const meta = readMeta();
	const t = meta[type_acte];
	if (t?.file_path && existsSync(t.file_path)) {
		try { unlinkSync(t.file_path); } catch {}
	}
	delete meta[type_acte];
	writeMeta(meta);
	return json({ ok: true });
}
