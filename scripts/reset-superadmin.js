/**
 * Script de réinitialisation du mot de passe superadmin.
 * Usage : node scripts/reset-superadmin.js [nouveau_mot_de_passe]
 * Si aucun mot de passe n'est fourni, utilise "Admin1234!" par défaut.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const newPassword = process.argv[2] || 'Admin1234!';

async function main() {
	const superadmin = await prisma.utilisateur.findFirst({
		where: { role: 'superadmin' }
	});

	if (!superadmin) {
		console.error('❌ Aucun compte superadmin trouvé en base.');
		process.exit(1);
	}

	const hash = await bcrypt.hash(newPassword, 12);
	await prisma.utilisateur.update({
		where: { id: superadmin.id },
		data:  { password_hash: hash }
	});

	console.log(`✅ Mot de passe réinitialisé pour : ${superadmin.email}`);
	console.log(`🔑 Nouveau mot de passe : ${newPassword}`);
	console.log('⚠️  Changez-le dès votre prochaine connexion !');
}

main()
	.catch(e => { console.error(e); process.exit(1); })
	.finally(() => prisma.$disconnect());
