import { TYPE_ACTE_LABELS, formatDate, formatDateTime } from './helpers.js';

/** Shared: load pdfmake once */
async function getPdfMake() {
	const pdfMake = (await import('pdfmake/build/pdfmake')).default;
	const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
	pdfMake.vfs = pdfFonts.vfs;
	return pdfMake;
}

/** Shared: header block République + Commune */
function headerBlock(commune) {
	return [
		{
			columns: [
				{
					stack: [
						{ text: "REPUBLIQUE DE CÔTE D'IVOIRE", style: 'republique', alignment: 'center' },
						{ text: 'Union – Discipline – Travail', style: 'devise', alignment: 'center' },
						{ canvas: [{ type: 'line', x1: 0, y1: 5, x2: 220, y2: 5, lineWidth: 1 }] }
					],
					width: '*'
				},
				{ width: 20, text: '' },
				{
					stack: [
						{ text: commune.nom.toUpperCase(), style: 'commune', alignment: 'center' },
						{ text: commune.region, style: 'sous_commune', alignment: 'center' },
						{ text: commune.adresse, style: 'sous_commune', alignment: 'center' },
						{ text: `Tél. : ${commune.telephone}`, style: 'sous_commune', alignment: 'center' }
					],
					width: '*'
				}
			]
		},
		{ text: '\n' },
		{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 495, y2: 0, lineWidth: 2, lineColor: '#009A44' }] },
		{ text: '\n\n' }
	];
}

/** Shared: base styles */
const BASE_STYLES = {
	republique: { fontSize: 10, bold: true, color: '#1a1a1a' },
	devise: { fontSize: 8, italics: true, color: '#555', margin: [0, 2, 0, 0] },
	commune: { fontSize: 10, bold: true, color: '#009A44' },
	sous_commune: { fontSize: 8, color: '#555', margin: [0, 1, 0, 0] },
	tableStyle: { margin: [0, 4, 0, 4] },
	tableHeader: { fontSize: 10, bold: true, color: '#555', fillColor: '#f1f5f9' },
	tableValue: { fontSize: 11, color: '#1a1a1a' },
	mention_legale: { fontSize: 8, color: '#888', italics: true },
	signature_label: { fontSize: 10, bold: true, color: '#333' },
	signature_name: { fontSize: 9, color: '#555', margin: [0, 4, 0, 0] }
};

function triggerDownload(blob, filename) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

// ─── ACTE OFFICIEL ────────────────────────────────────────────────────────────

export async function generateActePDF(demande, commune) {
	const pdfMake = await getPdfMake();
	const typeLabel = TYPE_ACTE_LABELS[demande.type_acte] || demande.type_acte;
	const personne = demande.personne_concernee;
	// Use validated acte data if available, otherwise fall back to demande defaults
	const acte = demande.acte || {};
	const now = new Date();

	// Résoudre les valeurs officielles (acte validé > données de demande > fallback)
	const nomOfficiel    = acte.nom    || personne?.nom    || '';
	const prenomOfficiel = acte.prenom || personne?.prenom || '';
	const dateEvt        = acte.date_evenement || personne?.date_evenement || personne?.date_naissance || '';
	const lieuEvt        = acte.lieu_evenement || personne?.lieu_evenement || '';
	const numActe        = acte.numero_acte    || demande.id;
	const numRegistre    = acte.numero_registre || personne?.numero_registre || '';
	const folio          = acte.folio          || '';
	const dateActe       = acte.date_acte      ? new Date(acte.date_acte).toLocaleDateString('fr-FR') : now.toLocaleDateString('fr-FR');
	const officierNom    = acte.officier_nom   || commune?.maire || '';
	const officierQualite= acte.officier_qualite || 'Officier d\'état civil';
	const mentions       = acte.mentions_marginales || '';

	const tableRows = [
		[{ text: 'NOM ET PRÉNOM(S)', style: 'tableHeader' }, { text: `${nomOfficiel} ${prenomOfficiel}`, style: 'tableValue' }],
		...(dateEvt ? [[{ text: "DATE DE L'ÉVÉNEMENT", style: 'tableHeader' }, { text: formatDate(dateEvt), style: 'tableValue' }]] : []),
		...(lieuEvt ? [[{ text: "LIEU DE L'ÉVÉNEMENT", style: 'tableHeader' }, { text: lieuEvt, style: 'tableValue' }]] : []),
		...(numRegistre ? [[{ text: 'N° DE REGISTRE', style: 'tableHeader' }, { text: numRegistre, style: 'tableValue' }]] : []),
		...(folio ? [[{ text: 'FOLIO / PAGE', style: 'tableHeader' }, { text: folio, style: 'tableValue' }]] : []),
		[{ text: "N° DE L'ACTE", style: 'tableHeader' }, { text: numActe, style: 'tableValue' }],
		[{ text: 'NOMBRE DE COPIES', style: 'tableHeader' }, { text: `${demande.copies} copie(s)`, style: 'tableValue' }],
		[{ text: 'DATE DE DÉLIVRANCE', style: 'tableHeader' }, { text: dateActe, style: 'tableValue' }]
	];

	const docDefinition = {
		pageSize: 'A4',
		pageMargins: [50, 60, 50, 60],
		content: [
			...headerBlock(commune),
			{ text: typeLabel.toUpperCase(), style: 'titre_acte', alignment: 'center' },
			{
				columns: [
					{ text: `N° de l'acte : ${numActe}`, style: 'numero_dossier', alignment: 'left' },
					{ text: `Dossier : ${demande.id}`, style: 'numero_dossier', alignment: 'right' }
				]
			},
			{ text: '\n' },
			{
				text: [
					'Nous, ',
					{ text: officierNom, bold: true },
					`, ${officierQualite} de la ${commune.nom},\ncertifions qu'il a été procédé à l'établissement du présent ${typeLabel.toLowerCase()}.`
				],
				style: 'corps'
			},
			{ text: '\n' },
			{
				style: 'tableStyle',
				table: { widths: [180, '*'], body: tableRows },
				layout: { fillColor: (i) => i % 2 === 0 ? '#f8fafc' : null, hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0' }
			},
			{ text: '\n' },
			...(mentions ? [{
				text: [{ text: 'Mentions marginales : ', bold: true, fontSize: 9, color: '#555' }, { text: mentions, fontSize: 9, color: '#555', italics: true }],
				margin: [0, 0, 0, 8]
			}] : []),
			{ text: '\n' },
			{
				text: `Le présent acte a été délivré conformément aux dispositions du Code de l'état civil ivoirien. Il ne peut être utilisé qu'aux fins légales expressément autorisées. Toute falsification ou usage frauduleux sera poursuivi conformément à la loi.`,
				style: 'mention_legale', alignment: 'center'
			},
			{ text: '\n\n' },
			{
				columns: [
					{
						stack: [
							{ text: 'Le Demandeur', style: 'signature_label', alignment: 'center' },
							{ text: '\n\n\n' },
							{ canvas: [{ type: 'line', x1: 20, y1: 0, x2: 160, y2: 0, lineWidth: 1 }] },
							{ text: `${demande.demandeur.prenom} ${demande.demandeur.nom}`, style: 'signature_name', alignment: 'center' }
						]
					},
					{ width: 50, text: '' },
					{
						stack: [
							{ text: `${officierQualite} — ${commune.nom}`, style: 'signature_label', alignment: 'center' },
							{ text: '\n\n\n' },
							{ canvas: [{ type: 'line', x1: 20, y1: 0, x2: 160, y2: 0, lineWidth: 1 }] },
							{ text: officierNom, style: 'signature_name', alignment: 'center' }
						]
					}
				]
			},
			{ canvas: [{ type: 'ellipse', x: 420, y: -80, r1: 45, r2: 45, lineWidth: 2, lineColor: '#009A44', fillOpacity: 0 }], absolutePosition: { x: 400, y: 680 } }
		],
		styles: {
			...BASE_STYLES,
			titre_acte: { fontSize: 18, bold: true, color: '#009A44', margin: [0, 0, 0, 4] },
			numero_dossier: { fontSize: 9, color: '#888', margin: [0, 0, 0, 8] },
			corps: { fontSize: 11, lineHeight: 1.5, color: '#333' }
		},
		defaultStyle: { font: 'Roboto' }
	};

	return new Promise((resolve) => pdfMake.createPdf(docDefinition).getBlob(resolve));
}

export async function downloadActePDF(demande, commune) {
	const blob = await generateActePDF(demande, commune);
	triggerDownload(blob, `${demande.id}-${demande.type_acte}.pdf`);
}

// ─── ATTESTATION DE DÉPÔT ────────────────────────────────────────────────────

export async function downloadAttestationDepotPDF(demande, commune) {
	const pdfMake = await getPdfMake();
	const typeLabel = TYPE_ACTE_LABELS[demande.type_acte] || demande.type_acte;
	const dateDepot = new Date(demande.created_at);
	const MODE_LABELS = {
		mairie: 'Retrait en mairie',
		whatsapp: 'Envoi WhatsApp',
		email: 'Envoi par e-mail'
	};
	const refNum = `ATT-${demande.id}`;

	const docDefinition = {
		pageSize: 'A4',
		pageMargins: [50, 60, 50, 60],
		content: [
			...headerBlock(commune),

			{ text: 'ATTESTATION DE DÉPÔT DE DEMANDE', style: 'titre_doc', alignment: 'center' },
			{ text: 'Service État Civil — CiviCI', style: 'sous_titre', alignment: 'center' },
			{ text: '\n' },
			{
				columns: [
					{ text: `Réf. : ${refNum}`, style: 'ref_text' },
					{
						text: `Émise le : ${dateDepot.toLocaleDateString('fr-FR')} à ${dateDepot.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
						style: 'ref_text', alignment: 'right'
					}
				]
			},
			{ text: '\n' },
			{
				text: [
					`Nous, le Service État Civil de la Mairie de `,
					{ text: commune.nom, bold: true },
					`, attestons avoir reçu la demande suivante, déposée par voie numérique via la plateforme CiviCI.`
				],
				style: 'corps'
			},
			{ text: '\n' },
			{
				style: 'tableStyle',
				table: {
					widths: [190, '*'],
					body: [
						[{ text: 'N° DE DOSSIER', style: 'tableHeader' }, { text: demande.id, style: 'tableValueBold' }],
						[{ text: 'TYPE D\'ACTE DEMANDÉ', style: 'tableHeader' }, { text: typeLabel, style: 'tableValue' }],
						[{ text: 'NOM DU DEMANDEUR', style: 'tableHeader' }, { text: `${demande.demandeur.prenom} ${demande.demandeur.nom}`, style: 'tableValue' }],
						[{ text: 'CONTACT', style: 'tableHeader' }, { text: demande.demandeur.telephone, style: 'tableValue' }],
						[{ text: 'DATE DE DÉPÔT', style: 'tableHeader' }, { text: dateDepot.toLocaleDateString('fr-FR'), style: 'tableValue' }],
						[{ text: 'NOMBRE DE COPIES', style: 'tableHeader' }, { text: `${demande.copies} copie(s)`, style: 'tableValue' }],
						[{ text: 'MODE DE RÉCUPÉRATION', style: 'tableHeader' }, { text: MODE_LABELS[demande.mode_reception] || demande.mode_reception, style: 'tableValue' }]
					]
				},
				layout: { fillColor: (i) => i % 2 === 0 ? '#f8fafc' : null, hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0' }
			},
			{ text: '\n' },
			{
				text: 'Ce document atteste uniquement du dépôt de la demande. Il ne constitue pas l\'acte définitif et ne préjuge pas de la suite donnée à votre dossier. Conservez cette attestation jusqu\'à la délivrance de votre acte.',
				style: 'mention_legale', alignment: 'center'
			},
			{ text: '\n\n\n' },
			{
				columns: [
					{
						stack: [
							{ text: 'Le Demandeur', style: 'signature_label', alignment: 'center' },
							{ text: '\n\n\n' },
							{ canvas: [{ type: 'line', x1: 10, y1: 0, x2: 160, y2: 0, lineWidth: 1 }] },
							{ text: `${demande.demandeur.prenom} ${demande.demandeur.nom}`, style: 'signature_name', alignment: 'center' }
						]
					},
					{ width: 30, text: '' },
					{
						stack: [
							{ text: `Service État Civil — ${commune.nom}`, style: 'signature_label', alignment: 'center' },
							{ text: '\n\n\n' },
							{ canvas: [{ type: 'line', x1: 10, y1: 0, x2: 180, y2: 0, lineWidth: 1 }] },
							{ text: 'Cachet et signature', style: 'signature_name', alignment: 'center' }
						]
					}
				]
			},
			{ canvas: [{ type: 'ellipse', x: 0, y: 0, r1: 40, r2: 40, lineWidth: 2, lineColor: '#009A44', fillOpacity: 0 }], absolutePosition: { x: 390, y: 690 } }
		],
		styles: {
			...BASE_STYLES,
			titre_doc: { fontSize: 16, bold: true, color: '#1a3a5c', margin: [0, 0, 0, 4] },
			sous_titre: { fontSize: 9, color: '#009A44', margin: [0, 0, 0, 8] },
			ref_text: { fontSize: 9, color: '#555', italics: true },
			corps: { fontSize: 11, lineHeight: 1.6, color: '#333' },
			tableValueBold: { fontSize: 11, bold: true, color: '#009A44' }
		},
		defaultStyle: { font: 'Roboto' }
	};

	const blob = await new Promise((resolve) => pdfMake.createPdf(docDefinition).getBlob(resolve));
	triggerDownload(blob, `attestation-depot-${demande.id}.pdf`);
}

// ─── REÇU DE PAIEMENT ────────────────────────────────────────────────────────

export async function downloadRecuPaiementPDF(demande, commune) {
	const pdfMake = await getPdfMake();
	const typeLabel = TYPE_ACTE_LABELS[demande.type_acte] || demande.type_acte;
	const paiement = demande.paiement || {};
	const datePaiement = new Date(demande.updated_at || demande.created_at);
	const refRecu = `RCP-${demande.id}`;

	const MODE_LABELS = {
		mairie: 'Espèces au guichet — Mairie',
		mobile_money: 'Mobile Money (MTN / Orange Money)',
		en_ligne: 'Paiement en ligne'
	};
	const modeLabel = MODE_LABELS[paiement.mode] || paiement.mode || 'Non précisé';
	const montant = paiement.montant || 0;

	const docDefinition = {
		pageSize: 'A4',
		pageMargins: [50, 60, 50, 60],
		content: [
			...headerBlock(commune),

			{ text: 'REÇU DE PAIEMENT', style: 'titre_recu', alignment: 'center' },
			{ text: 'Service Finances — État Civil', style: 'sous_titre', alignment: 'center' },
			{ text: '\n' },
			{
				columns: [
					{ text: `N° Reçu : ${refRecu}`, style: 'ref_text' },
					{
						text: `Le : ${datePaiement.toLocaleDateString('fr-FR')} à ${datePaiement.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
						style: 'ref_text', alignment: 'right'
					}
				]
			},
			{ text: '\n' },
			{
				text: [
					`La Mairie de `,
					{ text: commune.nom, bold: true },
					` certifie avoir perçu le paiement des frais de dossier dans les conditions suivantes :`
				],
				style: 'corps'
			},
			{ text: '\n' },
			{
				style: 'tableStyle',
				table: {
					widths: [190, '*'],
					body: [
						[{ text: 'N° DE DOSSIER', style: 'tableHeader' }, { text: demande.id, style: 'tableValue' }],
						[{ text: 'DEMANDEUR', style: 'tableHeader' }, { text: `${demande.demandeur.prenom} ${demande.demandeur.nom}`, style: 'tableValue' }],
						[{ text: 'ACTE DEMANDÉ', style: 'tableHeader' }, { text: typeLabel, style: 'tableValue' }],
						[{ text: 'COPIES', style: 'tableHeader' }, { text: `${demande.copies} copie(s)`, style: 'tableValue' }],
						[{ text: 'MODE DE PAIEMENT', style: 'tableHeader' }, { text: modeLabel, style: 'tableValue' }],
						...(paiement.reference ? [[{ text: 'RÉFÉRENCE TRANSACTION', style: 'tableHeader' }, { text: paiement.reference, style: 'tableValue' }]] : []),
						[{ text: 'DATE DE PAIEMENT', style: 'tableHeader' }, { text: datePaiement.toLocaleDateString('fr-FR'), style: 'tableValue' }],
						[{ text: 'MONTANT RÉGLÉ', style: 'tableHeader' }, { text: `${montant.toLocaleString('fr-FR')} FCFA`, style: 'montant_cell' }]
					]
				},
				layout: { fillColor: (i) => i % 2 === 0 ? '#f8fafc' : null, hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0' }
			},
			{ text: '\n' },

			// Tampon ACQUITTÉ
			{
				canvas: [
					{ type: 'rect', x: 0, y: 0, w: 180, h: 52, r: 6, lineWidth: 3, lineColor: '#009A44', fillOpacity: 0 }
				],
				absolutePosition: { x: 305, y: 500 }
			},
			{ text: 'ACQUITTÉ', style: 'acquitte', absolutePosition: { x: 305, y: 513 }, width: 180 },

			{ text: '\n\n' },
			{
				text: 'Ce reçu est délivré à titre de justificatif de paiement uniquement. Les frais perçus ne sont pas remboursables sauf annulation administrative. Conservez ce document jusqu\'à la réception de votre acte.',
				style: 'mention_legale', alignment: 'center'
			},
			{ text: '\n\n\n' },
			{
				columns: [
					{
						stack: [
							{ text: 'Le Bénéficiaire', style: 'signature_label', alignment: 'center' },
							{ text: '\n\n\n' },
							{ canvas: [{ type: 'line', x1: 10, y1: 0, x2: 160, y2: 0, lineWidth: 1 }] },
							{ text: `${demande.demandeur.prenom} ${demande.demandeur.nom}`, style: 'signature_name', alignment: 'center' }
						]
					},
					{ width: 30, text: '' },
					{
						stack: [
							{ text: 'Le Caissier / Agent', style: 'signature_label', alignment: 'center' },
							{ text: '\n\n\n' },
							{ canvas: [{ type: 'line', x1: 10, y1: 0, x2: 180, y2: 0, lineWidth: 1 }] },
							{ text: `Service Finances — ${commune.nom}`, style: 'signature_name', alignment: 'center' }
						]
					}
				]
			},
			{ canvas: [{ type: 'ellipse', x: 0, y: 0, r1: 40, r2: 40, lineWidth: 2, lineColor: '#009A44', fillOpacity: 0 }], absolutePosition: { x: 390, y: 700 } }
		],
		styles: {
			...BASE_STYLES,
			titre_recu: { fontSize: 20, bold: true, color: '#1a3a5c', margin: [0, 0, 0, 4] },
			sous_titre: { fontSize: 9, color: '#009A44', margin: [0, 0, 0, 8] },
			ref_text: { fontSize: 9, color: '#555', italics: true },
			corps: { fontSize: 11, lineHeight: 1.6, color: '#333' },
			montant_cell: { fontSize: 13, bold: true, color: '#009A44' },
			acquitte: { fontSize: 20, bold: true, color: '#009A44', alignment: 'center' }
		},
		defaultStyle: { font: 'Roboto' }
	};

	const blob = await new Promise((resolve) => pdfMake.createPdf(docDefinition).getBlob(resolve));
	triggerDownload(blob, `recu-paiement-${demande.id}.pdf`);
}

// ─── BON DE REMBOURSEMENT ─────────────────────────────────────────────────────

export async function downloadBonRemboursementPDF(demande, commune) {
	const pdfMake = await getPdfMake();
	const typeLabel = TYPE_ACTE_LABELS[demande.type_acte] || demande.type_acte;
	const remb = demande.paiement?.remboursement || {};
	const paiement = demande.paiement || {};
	const dateRemb = new Date(remb.date_remboursement || remb.date_demande);
	const refDoc = `RMB-${demande.id}`;

	const MODE_LABELS = {
		mairie: 'Espèces au guichet — Mairie',
		mobile_money: 'Mobile Money (MTN / Orange Money)',
		en_ligne: 'Paiement en ligne'
	};
	const modeLabel = MODE_LABELS[paiement.mode] || paiement.mode || 'Non précisé';
	const montant = paiement.montant || 0;

	const docDefinition = {
		pageSize: 'A4',
		pageMargins: [50, 60, 50, 60],
		content: [
			...headerBlock(commune),

			{ text: 'BON DE REMBOURSEMENT', style: 'titre_remb', alignment: 'center' },
			{ text: 'Service Finances — État Civil', style: 'sous_titre', alignment: 'center' },
			{ text: '\n' },
			{
				columns: [
					{ text: `N° Bon : ${refDoc}`, style: 'ref_text' },
					{
						text: `Le : ${dateRemb.toLocaleDateString('fr-FR')}`,
						style: 'ref_text', alignment: 'right'
					}
				]
			},
			{ text: '\n' },
			{
				text: [
					`La Mairie de `,
					{ text: commune.nom, bold: true },
					` procède au remboursement des frais de dossier suite au rejet de la demande référencée ci-dessous. Ce remboursement est définitif.`
				],
				style: 'corps'
			},
			{ text: '\n' },
			{
				style: 'tableStyle',
				table: {
					widths: [190, '*'],
					body: [
						[{ text: 'N° DE DOSSIER', style: 'tableHeader' }, { text: demande.id, style: 'tableValue' }],
						[{ text: 'DEMANDEUR', style: 'tableHeader' }, { text: `${demande.demandeur.prenom} ${demande.demandeur.nom}`, style: 'tableValue' }],
						[{ text: 'CONTACT', style: 'tableHeader' }, { text: demande.demandeur.telephone, style: 'tableValue' }],
						[{ text: 'ACTE DEMANDÉ', style: 'tableHeader' }, { text: typeLabel, style: 'tableValue' }],
						[{ text: 'MODE DE PAIEMENT INITIAL', style: 'tableHeader' }, { text: modeLabel, style: 'tableValue' }],
						...(paiement.reference ? [[{ text: 'RÉF. TRANSACTION INITIALE', style: 'tableHeader' }, { text: paiement.reference, style: 'tableValue' }]] : []),
						...(remb.reference ? [[{ text: 'RÉF. REMBOURSEMENT', style: 'tableHeader' }, { text: remb.reference, style: 'tableValue' }]] : []),
						[{ text: 'DATE DU REMBOURSEMENT', style: 'tableHeader' }, { text: dateRemb.toLocaleDateString('fr-FR'), style: 'tableValue' }],
						[{ text: 'MONTANT REMBOURSÉ', style: 'tableHeader' }, { text: `${montant.toLocaleString('fr-FR')} FCFA`, style: 'montant_cell' }]
					]
				},
				layout: { fillColor: (i) => i % 2 === 0 ? '#f8fafc' : null, hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0' }
			},
			{ text: '\n' },

			// Tampon REMBOURSÉ
			{
				canvas: [
					{ type: 'rect', x: 0, y: 0, w: 180, h: 52, r: 6, lineWidth: 3, lineColor: '#f59e0b', fillOpacity: 0 }
				],
				absolutePosition: { x: 305, y: 520 }
			},
			{ text: 'REMBOURSÉ', style: 'rembourse_stamp', absolutePosition: { x: 305, y: 533 }, width: 180 },

			{ text: '\n\n' },
			{
				text: `Ce bon de remboursement atteste que la somme de ${montant.toLocaleString('fr-FR')} FCFA a été restituée au demandeur suite au rejet administratif de sa demande. Aucun recours ultérieur sur ce montant ne sera accepté.`,
				style: 'mention_legale', alignment: 'center'
			},
			{ text: '\n\n\n' },
			{
				columns: [
					{
						stack: [
							{ text: 'Le Bénéficiaire', style: 'signature_label', alignment: 'center' },
							{ text: '\n\n\n' },
							{ canvas: [{ type: 'line', x1: 10, y1: 0, x2: 160, y2: 0, lineWidth: 1 }] },
							{ text: `${demande.demandeur.prenom} ${demande.demandeur.nom}`, style: 'signature_name', alignment: 'center' }
						]
					},
					{ width: 30, text: '' },
					{
						stack: [
							{ text: `Le Superviseur — ${commune.nom}`, style: 'signature_label', alignment: 'center' },
							{ text: '\n\n\n' },
							{ canvas: [{ type: 'line', x1: 10, y1: 0, x2: 180, y2: 0, lineWidth: 1 }] },
							{ text: remb.traite_par || 'Service Finances', style: 'signature_name', alignment: 'center' }
						]
					}
				]
			},
			{ canvas: [{ type: 'ellipse', x: 0, y: 0, r1: 40, r2: 40, lineWidth: 2, lineColor: '#f59e0b', fillOpacity: 0 }], absolutePosition: { x: 390, y: 700 } }
		],
		styles: {
			...BASE_STYLES,
			titre_remb: { fontSize: 20, bold: true, color: '#92400e', margin: [0, 0, 0, 4] },
			sous_titre: { fontSize: 9, color: '#f59e0b', margin: [0, 0, 0, 8] },
			ref_text: { fontSize: 9, color: '#555', italics: true },
			corps: { fontSize: 11, lineHeight: 1.6, color: '#333' },
			montant_cell: { fontSize: 13, bold: true, color: '#d97706' },
			rembourse_stamp: { fontSize: 20, bold: true, color: '#d97706', alignment: 'center' }
		},
		defaultStyle: { font: 'Roboto' }
	};

	const blob = await new Promise((resolve) => pdfMake.createPdf(docDefinition).getBlob(resolve));
	triggerDownload(blob, `bon-remboursement-${demande.id}.pdf`);
}

// ─── RÉCAPITULATIF CITOYEN (SUIVI COMPLET) ────────────────────────────────────

const DOCS_REQUIS_LABELS = {
	naissance:               ['CNI ou passeport du déclarant', 'Bulletin de naissance de la maternité', 'Carnet de mariage des parents (si disponible)'],
	mariage:                 ['CNI des deux époux', 'Extrait de naissance des deux époux', 'Certificat de célibat', 'Témoins (2) avec CNI'],
	deces:                   ['CNI du déclarant', 'Certificat médical de décès', 'CNI du défunt (si disponible)'],
	attestation_concubinage: ['CNI des deux concubins', 'Justificatif de domicile commun'],
	attestation_domicile:    ['CNI du demandeur', 'Justificatif de domicile (facture eau/électricité)'],
	certification_documents: ['Document original à certifier', 'CNI du demandeur'],
	legalisation:            ['Document à légaliser', 'CNI du demandeur'],
	inscription_livret:      ['Livret de famille original', 'Acte de naissance de l\'enfant', 'CNI des deux parents'],
	duplicata_livret:        ['CNI des deux époux', 'Extrait de naissance des époux', 'Déclaration de perte (si perte)'],
	certificat_vie_entretien:['CNI du demandeur', 'Présence physique obligatoire'],
	certificat_vie_adulte:   ['CNI du demandeur', 'Présence physique obligatoire'],
	fiche_familiale:         ['CNI du chef de famille', 'Livret de famille', 'Extrait de naissance de chaque enfant'],
	fiche_individuelle:      ['CNI du demandeur', 'Extrait de naissance']
};

const STATUT_LABELS_FR = {
	recue:       'Reçue — en attente de traitement',
	en_cours:    'En cours de traitement',
	traitee:     'Traitée — en attente de retrait',
	disponible:  'Disponible — prête à retirer',
	rejetee:     'Rejetée',
	en_attente:  'En attente'
};

const NEXT_STEPS = {
	recue:      'Votre demande a été enregistrée. Un agent va la prendre en charge dans les meilleurs délais.',
	en_cours:   'Votre dossier est en cours de traitement par nos agents. Vous serez notifié(e) dès qu\'il sera prêt.',
	traitee:    'Votre document est prêt. Présentez-vous au guichet de l\'état civil avec ce reçu et votre pièce d\'identité.',
	disponible: 'Votre document est disponible. Présentez-vous au guichet de l\'état civil avec ce reçu et votre pièce d\'identité.',
	rejetee:    'Votre demande a été rejetée. Contactez la mairie pour plus d\'informations ou soumettez une nouvelle demande.'
};

export async function downloadSuiviCompletPDF(demande, commune) {
	const pdfMake = await getPdfMake();
	const typeLabel = TYPE_ACTE_LABELS[demande.type_acte] || demande.type_acte;
	const docsRequis = DOCS_REQUIS_LABELS[demande.type_acte] || ['Pièce d\'identité valide'];
	const statutLabel = STATUT_LABELS_FR[demande.statut] || demande.statut;
	const nextStep = NEXT_STEPS[demande.statut] || '';
	const now = new Date();

	// Status color
	const statusColors = {
		recue: '#3b82f6', en_cours: '#f59e0b',
		traitee: '#10b981', disponible: '#059669', rejetee: '#ef4444'
	};
	const statusColor = statusColors[demande.statut] || '#6b7280';

	// Build historique summary (last 5 entries)
	const lastActions = (demande.historique || []).slice(-5).reverse().map(h => [
		{ text: new Date(h.date).toLocaleDateString('fr-FR'), style: 'hist_date' },
		{ text: h.statut || '—', style: 'hist_statut' },
		{ text: h.note || '—', style: 'hist_note' }
	]);

	const docDefinition = {
		pageSize: 'A4',
		pageMargins: [45, 55, 45, 55],
		content: [
			...headerBlock(commune),

			// Title
			{
				columns: [
					{
						stack: [
							{ text: 'RÉCAPITULATIF DE DEMANDE', style: 'titre_suivi' },
							{ text: `Référence : ${demande.id}`, style: 'ref_suivi' },
							{ text: `Généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, style: 'date_gen' }
						]
					},
					{
						stack: [
							{ text: statutLabel.toUpperCase(), style: 'statut_badge', color: statusColor }
						],
						alignment: 'right'
					}
				]
			},
			{ canvas: [{ type: 'line', x1: 0, y1: 8, x2: 505, y2: 8, lineWidth: 1, lineColor: '#e5e7eb' }] },
			{ text: '\n' },

			// Two columns: demandeur + service
			{
				columns: [
					{
						stack: [
							{ text: 'DEMANDEUR', style: 'section_label' },
							{
								style: 'info_table',
								table: {
									widths: [80, '*'],
									body: [
										[{ text: 'Nom complet', style: 'tbl_key' }, { text: `${demande.demandeur.prenom} ${demande.demandeur.nom}`, style: 'tbl_val' }],
										[{ text: 'Téléphone', style: 'tbl_key' }, { text: demande.demandeur.telephone || '—', style: 'tbl_val' }],
										[{ text: 'CNI', style: 'tbl_key' }, { text: demande.demandeur.cni || '—', style: 'tbl_val' }]
									]
								},
								layout: 'noBorders'
							}
						],
						width: '*'
					},
					{ width: 20, text: '' },
					{
						stack: [
							{ text: 'SERVICE DEMANDÉ', style: 'section_label' },
							{
								style: 'info_table',
								table: {
									widths: [80, '*'],
									body: [
										[{ text: 'Type', style: 'tbl_key' }, { text: typeLabel, style: 'tbl_val' }],
										...(demande.copies > 1 ? [[{ text: 'Copies', style: 'tbl_key' }, { text: `${demande.copies} copie(s)`, style: 'tbl_val' }]] : []),
										[{ text: 'Soumis le', style: 'tbl_key' }, { text: formatDate(demande.created_at), style: 'tbl_val' }],
										...(demande.paiement ? [[{ text: 'Frais', style: 'tbl_key' }, { text: `${demande.paiement.montant?.toLocaleString('fr-FR') || 0} FCFA`, style: 'tbl_val' }]] : [])
									]
								},
								layout: 'noBorders'
							}
						],
						width: '*'
					}
				]
			},
			{ text: '\n' },

			// Paiement status
			...(demande.paiement ? [{
				fillColor: demande.paiement.statut === 'paye' ? '#f0fdf4' : '#fffbeb',
				table: {
					widths: ['*'],
					body: [[{
						stack: [
							{
								columns: [
									{ text: demande.paiement.statut === 'paye' ? '✓ Paiement confirmé' : '⏳ Paiement en attente', style: demande.paiement.statut === 'paye' ? 'pay_ok' : 'pay_pending', width: '*' },
									{ text: `${demande.paiement.montant?.toLocaleString('fr-FR')} FCFA`, style: 'pay_amount', alignment: 'right', width: 'auto' }
								]
							},
							...(demande.paiement.reference ? [{ text: `Réf. transaction : ${demande.paiement.reference}`, style: 'pay_ref' }] : [])
						],
						margin: [12, 8, 12, 8]
					}]]
				},
				layout: { hLineWidth: () => 0, vLineWidth: () => 0 }
			}] : []),
			{ text: '\n' },

			// Documents à apporter
			{ text: 'DOCUMENTS À APPORTER AU RETRAIT', style: 'section_label' },
			{
				ul: docsRequis,
				style: 'docs_list',
				margin: [10, 4, 0, 12]
			},

			// Instructions
			{
				fillColor: '#f8fafc',
				table: {
					widths: ['*'],
					body: [[{
						stack: [
							{ text: '📋 PROCHAINE ÉTAPE', style: 'next_title' },
							{ text: nextStep, style: 'next_body' }
						],
						margin: [12, 10, 12, 10]
					}]]
				},
				layout: { hLineWidth: () => 0, vLineWidth: () => 0 }
			},
			{ text: '\n' },

			// Historique abrégé
			...(lastActions.length > 0 ? [
				{ text: 'HISTORIQUE RÉCENT', style: 'section_label' },
				{
					style: 'tableStyle',
					table: {
						widths: [80, 100, '*'],
						body: [
							[{ text: 'Date', style: 'tableHeader' }, { text: 'Statut', style: 'tableHeader' }, { text: 'Note', style: 'tableHeader' }],
							...lastActions
						]
					}
				},
				{ text: '\n' }
			] : []),

			// Footer info
			{ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 505, y2: 0, lineWidth: 1, lineColor: '#e5e7eb' }] },
			{ text: '\n' },
			{
				columns: [
					{
						stack: [
							{ text: `${commune.nom}`, style: 'footer_commune' },
							{ text: commune.adresse, style: 'footer_info' },
							{ text: `Tél. : ${commune.telephone}`, style: 'footer_info' }
						]
					},
					{
						stack: [
							{ text: 'Vérification en ligne', style: 'footer_commune', alignment: 'right' },
							{ text: 'Ce document est un récapitulatif à titre informatif.', style: 'footer_info', alignment: 'right' },
							{ text: 'Il ne constitue pas l\'acte officiel.', style: 'footer_info', alignment: 'right' }
						]
					}
				]
			}
		],
		styles: {
			...BASE_STYLES,
			titre_suivi:    { fontSize: 16, bold: true, color: '#111827', margin: [0, 0, 0, 4] },
			ref_suivi:      { fontSize: 11, color: '#009A44', bold: true, fontFamily: 'Courier' },
			date_gen:       { fontSize: 8, color: '#9ca3af', margin: [0, 2, 0, 0] },
			statut_badge:   { fontSize: 11, bold: true, margin: [0, 4, 0, 0] },
			section_label:  { fontSize: 9, bold: true, color: '#6b7280', letterSpacing: 1, margin: [0, 0, 0, 6] },
			tbl_key:        { fontSize: 9, color: '#9ca3af' },
			tbl_val:        { fontSize: 10, color: '#111827', bold: true },
			info_table:     { margin: [0, 0, 0, 0] },
			pay_ok:         { fontSize: 11, bold: true, color: '#059669' },
			pay_pending:    { fontSize: 11, bold: true, color: '#d97706' },
			pay_amount:     { fontSize: 13, bold: true, color: '#111827' },
			pay_ref:        { fontSize: 8, color: '#6b7280', italics: true, margin: [0, 2, 0, 0] },
			docs_list:      { fontSize: 10, color: '#374151', lineHeight: 1.5 },
			next_title:     { fontSize: 10, bold: true, color: '#1e40af', margin: [0, 0, 0, 4] },
			next_body:      { fontSize: 10, color: '#374151', lineHeight: 1.5 },
			hist_date:      { fontSize: 9, color: '#6b7280' },
			hist_statut:    { fontSize: 9, bold: true, color: '#374151' },
			hist_note:      { fontSize: 9, color: '#6b7280', italics: true },
			footer_commune: { fontSize: 9, bold: true, color: '#374151' },
			footer_info:    { fontSize: 8, color: '#9ca3af', margin: [0, 1, 0, 0] }
		},
		defaultStyle: { font: 'Roboto' }
	};

	const blob = await new Promise((resolve) => pdfMake.createPdf(docDefinition).getBlob(resolve));
	triggerDownload(blob, `suivi-${demande.id}.pdf`);
}
