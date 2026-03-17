/**
 * Gestion des codes de vérification pour les documents officiels.
 * Chaque document (attestation, reçu, acte) reçoit un code unique
 * qui permet de vérifier son authenticité via /verifier/[code].
 */
import { randomBytes } from 'crypto';
import { readVerifCodes, writeVerifCodes } from './data.js';

const PREFIXES = {
	attestation: 'ATT',
	recu:        'RCP',
	acte:        'ACT'
};

/**
 * Génère un code de vérification unique au format CV-[TYPE]-[8 chars hex majuscules].
 * Ex : CV-ATT-3K9MXP2Q
 */
function makeCode(type) {
	const suffix = randomBytes(4).toString('hex').toUpperCase();
	return `CV-${PREFIXES[type] || 'DOC'}-${suffix}`;
}

/**
 * Crée et enregistre un code de vérification pour un document.
 * Retourne le code généré.
 */
export function registerVerifCode(type, payload) {
	const codes = readVerifCodes();
	let code;
	// Collision-safe (très improbable mais sécurisé)
	do { code = makeCode(type); } while (codes[code]);
	codes[code] = {
		type,
		created_at: new Date().toISOString(),
		...payload
	};
	writeVerifCodes(codes);
	return code;
}

/**
 * Recherche un code et retourne les métadonnées associées, ou null si introuvable.
 */
export function lookupVerifCode(code) {
	const codes = readVerifCodes();
	return codes[code] || null;
}
