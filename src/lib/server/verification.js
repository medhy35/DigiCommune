/**
 * Codes de vérification pour les documents officiels.
 * Les codes sont stockés dans le champ JSONB verification_codes de la demande.
 */
import { randomBytes } from 'crypto';
import { lookupVerifCode as lookup } from './data.js';
import { prisma, getCommuneId } from './db.js';

/** Génère 4 octets aléatoires → 8 chars hex majuscules. Ex : 3K9MXP2Q */
function makeCode() {
	return randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Enregistre un code de vérification et retourne le hash généré.
 * @param {'attestation'|'recu'|'acte'} type
 * @param {string} demande_id
 */
export async function registerVerifCode(type, demande_id) {
	// Generate unique code
	let code;
	do {
		code = makeCode();
	} while (await lookup(code));

	// Read current verification_codes, merge new code, write back
	const commune_id = getCommuneId();
	const current = await prisma.demande.findFirst({
		where:  { id: demande_id, commune_id },
		select: { verification_codes: true }
	});
	const updated = { ...(current?.verification_codes || {}), [type]: code };
	await prisma.demande.update({
		where: { id: demande_id, commune_id },
		data:  { verification_codes: updated }
	});
	return code;
}

export { lookupVerifCode } from './data.js';
