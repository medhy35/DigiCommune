/**
 * Codes de vérification pour les documents officiels.
 * Structure lean : hash (8 chars) → { demande_id, type }
 * La vérification relit le dossier complet depuis demandes.json.
 */
import { randomBytes } from 'crypto';
import { readVerifCodes, writeVerifCodes } from './data.js';

/** Génère 4 octets aléatoires → 8 chars hex majuscules. Ex : 3K9MXP2Q */
function makeCode() {
	return randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Enregistre un code de vérification et retourne le hash généré.
 * @param {'attestation'|'recu'|'acte'} type
 * @param {string} demande_id
 */
export function registerVerifCode(type, demande_id) {
	const codes = readVerifCodes();
	let code;
	do { code = makeCode(); } while (codes[code]);
	codes[code] = { demande_id, type };
	writeVerifCodes(codes);
	return code;
}

/** Retourne { demande_id, type } ou null si code inconnu. */
export function lookupVerifCode(code) {
	return readVerifCodes()[code] || null;
}
