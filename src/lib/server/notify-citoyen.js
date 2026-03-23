/**
 * Notifications citoyen — couche d'abstraction pluggable.
 *
 * Pour activer un vrai provider SMS/WhatsApp, implémentez la fonction
 * `sendViaSmsProvider` ou `sendViaWhatsappProvider` ci-dessous et
 * renseignez les variables d'environnement correspondantes.
 *
 * Variables d'environnement supportées (à ajouter dans .env) :
 *   SMS_PROVIDER=africas_talking|twilio|orange   (optionnel)
 *   SMS_API_KEY=...
 *   SMS_USERNAME=...        (Africa's Talking)
 *   SMS_FROM=...            (numéro expéditeur)
 *   WHATSAPP_TOKEN=...      (Meta Cloud API)
 *   WHATSAPP_PHONE_ID=...
 */

const MESSAGES = {
	en_cours: (d) =>
		`Bonjour ${d.demandeur.prenom}, votre dossier ${d.id} est en cours de traitement. Vous serez notifié(e) dès qu'il sera prêt.`,

	complements_requis: (d) =>
		`Bonjour ${d.demandeur.prenom}, votre dossier ${d.id} nécessite des documents supplémentaires. Connectez-vous sur ${process.env.PUBLIC_URL || 'notre site'}/suivi pour en savoir plus.`,

	traitee: (d) =>
		`Bonjour ${d.demandeur.prenom}, votre dossier ${d.id} a été traité avec succès. Vous pouvez venir retirer votre acte à la mairie muni de votre pièce d'identité.`,

	disponible: (d) =>
		`Bonjour ${d.demandeur.prenom}, votre acte (dossier ${d.id}) est prêt et disponible. Venez le retirer à la mairie.`,

	rejetee: (d) =>
		`Bonjour ${d.demandeur.prenom}, votre dossier ${d.id} n'a pas pu être traité. Présentez-vous à la mairie pour plus d'informations.`,
};

/**
 * Envoie une notification SMS au citoyen si son statut a changé.
 * Appelé depuis le handler PATCH /api/demandes/[id].
 *
 * @param {object} demande - La demande mise à jour (après PATCH)
 * @param {string} ancienStatut
 * @param {string} nouveauStatut
 */
export async function notifierCitoyen(demande, ancienStatut, nouveauStatut) {
	if (ancienStatut === nouveauStatut) return;
	if (!MESSAGES[nouveauStatut]) return;

	const telephone = demande.demandeur?.telephone;
	if (!telephone) return;

	const message = MESSAGES[nouveauStatut](demande);

	// ── Log systématique (toujours actif) ────────────────────
	console.log(`[notif-citoyen] ${telephone} | ${nouveauStatut} | ${message}`);

	// ── Envoi réel selon le provider configuré ───────────────
	const provider = process.env.SMS_PROVIDER;
	try {
		if (provider === 'africas_talking') {
			await sendAfricasTalking(telephone, message);
		} else if (provider === 'twilio') {
			await sendTwilio(telephone, message);
		} else if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
			await sendWhatsApp(telephone, message);
		}
		// Si aucun provider → log console uniquement (mode développement)
	} catch (err) {
		console.error(`[notif-citoyen] Échec envoi ${provider || 'console'} :`, err.message);
	}
}

// ── Implémentations providers ────────────────────────────────────────────────

async function sendAfricasTalking(to, message) {
	const { default: AfricasTalking } = await import('africastalking');
	const at  = AfricasTalking({ apiKey: process.env.SMS_API_KEY, username: process.env.SMS_USERNAME });
	await at.SMS.send({ to: [to], message, from: process.env.SMS_FROM });
}

async function sendTwilio(to, message) {
	const twilio = (await import('twilio')).default;
	const client = twilio(process.env.SMS_API_KEY, process.env.SMS_API_SECRET);
	await client.messages.create({ body: message, from: process.env.SMS_FROM, to });
}

async function sendWhatsApp(to, message) {
	const phoneId = process.env.WHATSAPP_PHONE_ID;
	const token   = process.env.WHATSAPP_TOKEN;
	await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
		method:  'POST',
		headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			messaging_product: 'whatsapp',
			to:                to.replace(/\s/g, ''),
			type:              'text',
			text:              { body: message }
		})
	});
}
