import { TYPE_ACTE_LABELS, formatDate } from './helpers.js';

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
	const now = new Date();

	const docDefinition = {
		pageSize: 'A4',
		pageMargins: [50, 60, 50, 60],
		content: [
			...headerBlock(commune),
			{ text: typeLabel.toUpperCase(), style: 'titre_acte', alignment: 'center' },
			{ text: `N° de dossier : ${demande.id}`, style: 'numero_dossier', alignment: 'center' },
			{ text: '\n' },
			{
				text: [
					'Nous, ',
					{ text: commune.maire, bold: true },
					`, Maire de la ${commune.nom}, officier d'état civil,\ncertifions qu'il a été procédé à l'établissement du présent ${typeLabel.toLowerCase()}.`
				],
				style: 'corps'
			},
			{ text: '\n' },
			{
				style: 'tableStyle',
				table: {
					widths: [180, '*'],
					body: [
						[{ text: 'NOM ET PRÉNOM(S)', style: 'tableHeader' }, { text: `${personne.nom} ${personne.prenom}`, style: 'tableValue' }],
						[{ text: 'DATE DE NAISSANCE', style: 'tableHeader' }, { text: formatDate(personne.date_naissance), style: 'tableValue' }],
						...(personne.numero_registre ? [[{ text: 'N° DE REGISTRE', style: 'tableHeader' }, { text: personne.numero_registre, style: 'tableValue' }]] : []),
						[{ text: 'NOMBRE DE COPIES', style: 'tableHeader' }, { text: `${demande.copies} copie(s)`, style: 'tableValue' }],
						[{ text: 'DATE DE DÉLIVRANCE', style: 'tableHeader' }, { text: now.toLocaleDateString('fr-FR'), style: 'tableValue' }]
					]
				},
				layout: { fillColor: (i) => i % 2 === 0 ? '#f8fafc' : null, hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0' }
			},
			{ text: '\n\n' },
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
							{ text: `Le Maire de ${commune.nom}`, style: 'signature_label', alignment: 'center' },
							{
								image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
								width: 80, height: 40, alignment: 'center', opacity: 0.1
							},
							{ canvas: [{ type: 'line', x1: 20, y1: 0, x2: 160, y2: 0, lineWidth: 1 }] },
							{ text: commune.maire, style: 'signature_name', alignment: 'center' }
						]
					}
				]
			},
			{ canvas: [{ type: 'ellipse', x: 420, y: -80, r1: 45, r2: 45, lineWidth: 2, lineColor: '#009A44', fillOpacity: 0 }], absolutePosition: { x: 400, y: 680 } }
		],
		styles: {
			...BASE_STYLES,
			titre_acte: { fontSize: 18, bold: true, color: '#009A44', margin: [0, 0, 0, 4] },
			numero_dossier: { fontSize: 10, color: '#666', margin: [0, 0, 0, 8] },
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
