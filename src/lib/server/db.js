/**
 * Client Prisma singleton — à importer depuis toutes les routes serveur.
 * Évite de créer plusieurs connexions en dev (hot-reload).
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
	});

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}

/**
 * L'ID de la commune courante, lu depuis la variable d'environnement.
 * Chaque déploiement correspond à une commune.
 */
export function getCommuneId() {
	const id = process.env.COMMUNE_ID;
	if (!id) throw new Error('Variable COMMUNE_ID manquante dans .env');
	return id;
}
