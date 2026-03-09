import { TYPE_ACTE_LABELS, formatDate } from './helpers.js';

export async function generateActePDF(demande, commune) {
	// Dynamic import to avoid SSR issues
	const pdfMake = (await import('pdfmake/build/pdfmake')).default;
	const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default;
	pdfMake.vfs = pdfFonts.vfs;

	const typeLabel = TYPE_ACTE_LABELS[demande.type_acte] || demande.type_acte;
	const personne = demande.personne_concernee;
	const now = new Date();

	const docDefinition = {
		pageSize: 'A4',
		pageMargins: [50, 60, 50, 60],
		content: [
			// En-tête République
			{
				columns: [
					{
						stack: [
							{ text: 'REPUBLIQUE DE CÔTE D\'IVOIRE', style: 'republique', alignment: 'center' },
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
			{ text: '\n\n' },

			// Titre de l'acte
			{ text: typeLabel.toUpperCase(), style: 'titre_acte', alignment: 'center' },
			{ text: `N° de dossier : ${demande.id}`, style: 'numero_dossier', alignment: 'center' },
			{ text: '\n' },

			// Corps de l'acte
			{
				text: [
					'Nous, ',
					{ text: commune.maire, bold: true },
					`, Maire de la ${commune.nom}, officier d'état civil,\ncertifions qu'il a été procédé à l'établissement du présent ${typeLabel.toLowerCase()}.`
				],
				style: 'corps'
			},
			{ text: '\n' },

			// Tableau des informations
			{
				style: 'tableStyle',
				table: {
					widths: [180, '*'],
					body: [
						[
							{ text: 'NOM ET PRÉNOM(S)', style: 'tableHeader' },
							{ text: `${personne.nom} ${personne.prenom}`, style: 'tableValue' }
						],
						[
							{ text: 'DATE DE NAISSANCE', style: 'tableHeader' },
							{ text: formatDate(personne.date_naissance), style: 'tableValue' }
						],
						...(personne.numero_registre ? [[
							{ text: 'N° DE REGISTRE', style: 'tableHeader' },
							{ text: personne.numero_registre, style: 'tableValue' }
						]] : []),
						[
							{ text: 'NOMBRE DE COPIES', style: 'tableHeader' },
							{ text: `${demande.copies} copie(s)`, style: 'tableValue' }
						],
						[
							{ text: 'DATE DE DÉLIVRANCE', style: 'tableHeader' },
							{ text: now.toLocaleDateString('fr-FR'), style: 'tableValue' }
						]
					]
				},
				layout: {
					fillColor: (rowIndex) => rowIndex % 2 === 0 ? '#f8fafc' : null,
					hLineColor: () => '#e2e8f0',
					vLineColor: () => '#e2e8f0'
				}
			},
			{ text: '\n\n' },

			// Mention légale
			{
				text: `Le présent acte a été délivré conformément aux dispositions du Code de l'état civil ivoirien. Il ne peut être utilisé qu'aux fins légales expressément autorisées. Toute falsification ou usage frauduleux sera poursuivi conformément à la loi.`,
				style: 'mention_legale',
				alignment: 'center'
			},
			{ text: '\n\n' },

			// Signatures
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
								width: 80,
								height: 40,
								alignment: 'center',
								opacity: 0.1
							},
							{ canvas: [{ type: 'line', x1: 20, y1: 0, x2: 160, y2: 0, lineWidth: 1 }] },
							{ text: commune.maire, style: 'signature_name', alignment: 'center' }
						]
					}
				]
			},

			// Tampon fictif
			{
				canvas: [{
					type: 'ellipse',
					x: 420,
					y: -80,
					r1: 45,
					r2: 45,
					lineWidth: 2,
					lineColor: '#009A44',
					fillOpacity: 0
				}],
				absolutePosition: { x: 400, y: 680 }
			}
		],
		styles: {
			republique: { fontSize: 10, bold: true, color: '#1a1a1a' },
			devise: { fontSize: 8, italics: true, color: '#555', margin: [0, 2, 0, 0] },
			commune: { fontSize: 10, bold: true, color: '#009A44' },
			sous_commune: { fontSize: 8, color: '#555', margin: [0, 1, 0, 0] },
			titre_acte: { fontSize: 18, bold: true, color: '#009A44', margin: [0, 0, 0, 4], font: 'Roboto' },
			numero_dossier: { fontSize: 10, color: '#666', margin: [0, 0, 0, 8] },
			corps: { fontSize: 11, lineHeight: 1.5, color: '#333' },
			tableStyle: { margin: [0, 4, 0, 4] },
			tableHeader: { fontSize: 10, bold: true, color: '#555', fillColor: '#f1f5f9' },
			tableValue: { fontSize: 11, color: '#1a1a1a' },
			mention_legale: { fontSize: 8, color: '#888', italics: true },
			signature_label: { fontSize: 10, bold: true, color: '#333' },
			signature_name: { fontSize: 9, color: '#555', margin: [0, 4, 0, 0] }
		},
		defaultStyle: { font: 'Roboto' }
	};

	return new Promise((resolve) => {
		const pdf = pdfMake.createPdf(docDefinition);
		pdf.getBlob((blob) => resolve(blob));
	});
}

export async function downloadActePDF(demande, commune) {
	const blob = await generateActePDF(demande, commune);
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${demande.id}-${demande.type_acte}.pdf`;
	a.click();
	URL.revokeObjectURL(url);
}
