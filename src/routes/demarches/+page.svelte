<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	const VALID_TABS = ['naissance', 'mariage', 'deces', 'attestations', 'certifications', 'livret', 'certificats'];
	let activeTab = 'naissance';

	onMount(() => {
		// Priorité au state de navigation (pas de paramètre visible dans l'URL)
		const tabFromState = $page.state?.tab;
		if (tabFromState && VALID_TABS.includes(tabFromState)) {
			activeTab = tabFromState;
		}
	});

	const demarches = {
		naissance: {
			label: 'Naissance',
			icon: '👶',
			sections: [
				{
					id: 'declaration_naissance',
					title: 'Déclaration de naissance',
					subtitle: 'Enregistrer une naissance à l\'état civil',
					icon: '📋',
					urgent: true,
					delai: '3 mois à compter du jour de la naissance',
					delaiColor: 'red',
					description: 'La déclaration de naissance est obligatoire pour tout enfant né en Côte d\'Ivoire. Elle doit être effectuée dans un délai de 3 mois à compter de la naissance à la mairie du lieu de naissance.',
					documents: [
						{ label: 'Certificat de naissance', desc: 'Comportant le numéro d\'enregistrement, la signature du médecin ou de la sage-femme et le cachet du centre médical.', required: true, icon: '🏥' },
						{ label: 'Pièce d\'identité de la mère', desc: 'CNI, extrait de naissance, passeport ou certificat de nationalité.', required: true, icon: '🪪' },
						{ label: 'Pièce d\'identité du père', desc: 'CNI, extrait de naissance, passeport ou certificat de nationalité (s\'il y a lieu).', required: false, icon: '🪪' },
						{ label: 'Copie de l\'acte de mariage', desc: 'Uniquement si les parents sont mariés.', required: false, icon: '💍' },
						{ label: 'Reconnaissance anticipée', desc: 'S\'il y a lieu.', required: false, icon: '📄' }
					],
					frais: null,
					direction: 'Mairie du lieu de naissance',
					note: 'La déclaration tardive (au-delà de 3 mois) peut être effectuée, mais nécessite une procédure judiciaire particulière. Contactez la mairie pour plus d\'informations.'
				},
				{
					id: 'acte_naissance',
					title: 'Demande d\'acte de naissance',
					subtitle: 'Copie intégrale ou extrait simple',
					icon: '📄',
					urgent: false,
					delai: 'Quarante-huit (48) heures',
					delaiColor: 'green',
					description: 'La copie intégrale est une reproduction complète de l\'acte figurant dans le registre, avec toutes les mentions marginales. La demande peut se faire en ligne.',
					documents: [
						{ label: 'Références de l\'acte', desc: 'Numéro de l\'acte comportant l\'année, date de dressage, nom et prénom.', required: false, icon: '🔢' },
						{ label: 'Pièce d\'identité', desc: 'CNI, passeport ou tout document officiel valide.', required: true, icon: '🪪' },
						{ label: 'Copie ou photocopie de l\'acte', desc: 'Si disponible, pour faciliter la recherche dans les registres.', required: false, icon: '📋' }
					],
					frais: { montant: 2500, unite: 'FCFA', par: 'copie' },
					direction: 'Mairie',
					cta: { label: 'Faire une demande en ligne', serviceType: 'naissance' }
				},
				{
					id: 'extrait_egare',
					title: 'Copie d\'extrait d\'acte égaré',
					subtitle: 'Établir un extrait égaré ou détruit',
					icon: '🔍',
					urgent: false,
					delai: 'Non déterminé',
					delaiColor: 'gray',
					description: 'Il s\'agit d\'établir une copie d\'extrait d\'acte de naissance égaré ou détruit. En cas de recherches infructueuses, une procédure judiciaire peut être engagée.',
					documents: [
						{ label: 'Courrier de demande', desc: 'Adresser un courrier à la Mairie ou Sous-Préfecture de naissance précisant exactement vos nom, prénoms, ceux de vos père et mère, date de naissance et motif.', required: true, icon: '✉️' },
						{ label: 'En cas d\'échec : certificat de recherche infructueuse', desc: 'Demander un certificat de non-déclaration de naissance à la Mairie ou Sous-Préfecture, puis se rendre au Greffe pour poursuivre la démarche.', required: false, icon: '📋' }
					],
					frais: null,
					direction: 'Mairie ou Sous-Préfecture du lieu de naissance',
					note: 'Cette démarche nécessite une présence physique. En cas de recherches infructueuses, une démarche judiciaire sera engagée au Greffe.'
				}
			]
		},
		mariage: {
			label: 'Mariage',
			icon: '💍',
			sections: [
				{
					id: 'acte_mariage',
					title: 'Demande d\'acte de mariage',
					subtitle: 'Copie intégrale ou extrait',
					icon: '📄',
					urgent: false,
					delai: 'Quarante-huit (48) heures',
					delaiColor: 'green',
					description: 'Un acte de mariage peut être demandé par les époux, leurs ascendants, descendants, ou toute personne justifiant d\'un intérêt légitime.',
					documents: [
						{ label: 'Pièce d\'identité du demandeur', desc: 'CNI, passeport ou tout document officiel valide.', required: true, icon: '🪪' },
						{ label: 'Références de l\'acte', desc: 'Numéro d\'acte, date et lieu du mariage. Si non disponible, indiquez les noms et date approximative.', required: false, icon: '📋' }
					],
					frais: { montant: 2500, unite: 'FCFA', par: 'copie' },
					direction: 'Mairie',
					cta: { label: 'Faire une demande en ligne', serviceType: 'mariage' }
				},
				{
					id: 'dossier_mariage',
					title: 'Constitution du dossier de mariage',
					subtitle: 'Pièces à fournir pour se marier',
					icon: '📁',
					urgent: true,
					delai: 'Dépôt 30 à 10 jours avant la date du mariage',
					delaiColor: 'red',
					description: 'Tous les documents doivent être réunis et déposés entre 30 et 10 jours avant la date du mariage. Les retardataires ne seront plus tolérés.',
					documents: [
						{ label: 'Extrait d\'acte de naissance (× 2)', desc: 'Datant de moins de 3 mois avec la mention "DÉLIVRÉ EN VUE DE MARIAGE", ou jugement supplétif. Pour chaque futur époux.', required: true, icon: '📄' },
						{ label: 'Certificat de résidence (× 2)', desc: 'Datant de moins de 6 mois avec la mention "en vue de mariage". L\'un des époux doit résider dans la commune.', required: true, icon: '🏠' },
						{ label: 'Pièce d\'identité des futurs époux et témoins', desc: 'Photocopie lisible recto-verso sur la même page. CNI ou attestation d\'identité, passeport ou permis de conduire pour les témoins majeurs.', required: true, icon: '🪪' },
						{ label: 'Photo d\'identité couleur (× 2)', desc: 'Une photo pour chacun des futurs époux.', required: true, icon: '📸' },
						{ label: 'Adresse, téléphone et profession', desc: 'Des futurs époux et des témoins majeurs.', required: true, icon: '📝' },
						{ label: 'Documents spécifiques (si applicable)', desc: 'Voir conditions supplémentaires : dispense d\'âge, consentement parental, acte de décès du conjoint (veuf/ve), acte de divorce (divorcé/e), autorisation hiérarchique (militaire), certificat de capacité matrimoniale (étranger).', required: false, icon: '📋' }
					],
					frais: { montant: 100000, unite: 'FCFA', par: 'cérémonie' },
					direction: 'Mairie du domicile de l\'un des futurs époux',
					note: 'Le couple devra signer un engagement sur l\'honneur l\'obligeant à venir une heure (1H) à l\'avance avant la célébration. Du mercredi au samedi. Époux étrangers : extrait d\'acte certifié par le consulat + traduction en français si nécessaire.'
				}
			]
		},
		deces: {
			label: 'Décès',
			icon: '🕊️',
			sections: [
				{
					id: 'declaration_deces',
					title: 'Déclaration de décès',
					subtitle: 'Enregistrer un décès à l\'état civil',
					icon: '📋',
					urgent: true,
					delai: 'Quinze (15) jours à compter du jour du décès',
					delaiColor: 'red',
					description: 'La déclaration de décès est obligatoire et doit être effectuée dans les 15 jours suivant le constat du décès, auprès de la mairie du lieu de décès.',
					documents: [
						{ label: 'Procès-verbal de constatation de décès', desc: 'Délivré par le médecin ou l\'établissement ayant constaté le décès.', required: true, icon: '🏥' },
						{ label: 'Pièce d\'identité du défunt', desc: 'CNI, extrait de naissance, passeport ou certificat de nationalité.', required: true, icon: '🪪' },
						{ label: 'Pièce d\'identité du déclarant', desc: 'La personne qui déclare le décès.', required: true, icon: '🪪' },
						{ label: 'Copie de l\'acte de mariage du défunt', desc: 'Si le défunt était marié.', required: false, icon: '💍' },
						{ label: 'Copie du de-par-la-loi', desc: 'S\'il y a lieu.', required: false, icon: '📄' }
					],
					frais: null,
					direction: 'Mairie du lieu de décès',
					note: 'En cas de décès dans un établissement hospitalier, celui-ci peut se charger des démarches. En cas de décès à domicile, la déclaration doit être faite par un proche.'
				},
				{
					id: 'acte_deces',
					title: 'Demande d\'acte de décès',
					subtitle: 'Copie intégrale',
					icon: '📄',
					urgent: false,
					delai: 'Quarante-huit (48) heures',
					delaiColor: 'green',
					description: 'Un acte de décès est nécessaire pour les successions, les démarches auprès des assurances, la pension de réversion et d\'autres démarches administratives.',
					documents: [
						{ label: 'Références de l\'acte', desc: 'Numéro d\'acte, date et lieu du décès. Si non disponible, indiquez le nom du défunt et la date approximative.', required: false, icon: '📋' },
						{ label: 'Pièce d\'identité du demandeur', desc: 'CNI, passeport ou document officiel valide.', required: true, icon: '🪪' }
					],
					frais: { montant: 2500, unite: 'FCFA', par: 'copie' },
					direction: 'Mairie',
					cta: { label: 'Faire une demande en ligne', serviceType: 'deces' }
				}
			]
		},
		attestations: {
			label: 'Attestations',
			icon: '📜',
			sections: [
				{
					id: 'attestation_concubinage',
					title: 'Attestation de concubinage',
					subtitle: 'Attester une situation de vie commune',
					icon: '🤝',
					urgent: false,
					delai: 'Quarante-huit (48) heures',
					delaiColor: 'green',
					description: 'L\'attestation de concubinage permet d\'attester de l\'existence du concubinage afin de bénéficier de certaines aides ou prestations (prestations familiales, aide au logement, remboursement de soins). Il prend la forme d\'une lettre écrite, datée et signée sur l\'honneur par les deux concubins.',
					documents: [
						{ label: 'Pièce d\'identité des deux concubins', desc: 'CNI, passeport ou carte de séjour de chacun des concubins.', required: true, icon: '🪪' },
						{ label: 'Attestation sur l\'honneur', desc: 'Attestation rédigée, datée et revêtue de la signature des deux concubins déclarant leur situation de concubinage.', required: true, icon: '✍️' }
					],
					frais: { montant: 500, unite: 'FCFA', par: 'copie (frais de timbre)' },
					direction: 'Mairie du domicile du demandeur',
					cta: { label: 'Faire une demande en ligne', serviceType: 'attestation_concubinage' }
				},
				{
					id: 'attestation_domicile',
					title: 'Attestation de domicile',
					subtitle: 'Justifier de son adresse de résidence',
					icon: '🏠',
					urgent: false,
					delai: 'À préciser auprès de la mairie',
					delaiColor: 'gray',
					description: 'L\'attestation de domicile permet de justifier officiellement de son lieu de résidence auprès des organismes qui en font la demande.',
					documents: [
						{ label: 'Imprimé de déclaration sur l\'honneur', desc: 'Formulaire à remplir et signer. À retirer directement à la mairie.', required: true, icon: '📝' }
					],
					frais: null,
					direction: 'Mairie du domicile'
				},
				{
					id: 'recensement_militaire',
					title: 'Recensement militaire',
					subtitle: 'Participer au recensement obligatoire',
					icon: '🎖️',
					urgent: false,
					delai: 'Se renseigner auprès de la mairie',
					delaiColor: 'gray',
					description: 'Le recensement militaire est obligatoire pour les hommes et femmes de nationalité ivoirienne âgés de 18 ans au moins.',
					documents: [
						{ label: 'Extrait de naissance', desc: 'Extrait d\'acte de naissance valide.', required: true, icon: '📄' },
						{ label: 'Certificat de nationalité', desc: 'Attestant la nationalité ivoirienne.', required: true, icon: '🇨🇮' }
					],
					frais: null,
					direction: 'Toute Mairie',
					note: 'Personnes concernées : hommes et femmes de nationalité ivoirienne âgés de 18 ans au moins.'
				}
			]
		},
		certifications: {
			label: 'Certifications',
			icon: '✅',
			sections: [
				{
					id: 'certification_documents',
					title: 'Certification de documents',
					subtitle: 'Certifier la conformité d\'une photocopie',
					icon: '✅',
					urgent: false,
					delai: 'Vingt-quatre (24) à quarante-huit (48) heures',
					delaiColor: 'green',
					description: 'La certification est la procédure de validation d\'une ou plusieurs photocopies d\'un acte donné au vu de l\'original. Il s\'agit principalement de diplômes, relevés de notes, attestations, documents de soumission d\'appels d\'offre, etc.',
					documents: [
						{ label: 'Original du document à certifier', desc: 'Obligatoire pour comparer avec la photocopie. Exception : appels d\'offres où un courrier du représentant de la structure peut être accepté à la place de l\'original.', required: true, icon: '📄' },
						{ label: 'Pièce d\'identité du demandeur', desc: 'CNI de l\'intéressé ou d\'un parent (père, mère, tuteur légal). Obligatoire pour les représentants de structures.', required: true, icon: '🪪' }
					],
					frais: { montant: 500, unite: 'FCFA', par: 'copie' },
					direction: 'Mairie du domicile du demandeur',
					cta: { label: 'Faire une demande en ligne', serviceType: 'certification_documents' }
				},
				{
					id: 'legalisation',
					title: 'Légalisation de signature',
					subtitle: 'Authentifier la signature sur un document',
					icon: '🔏',
					urgent: false,
					delai: 'À préciser auprès de la mairie',
					delaiColor: 'gray',
					description: 'La légalisation authentifie la signature d\'un document. Les agents publics ne peuvent traiter des documents en langue étrangère non traduits en français.',
					documents: [
						{ label: 'Pièce d\'identité du signataire', desc: 'CNI, passeport ou carte de séjour du signataire du document à légaliser.', required: true, icon: '🪪' },
						{ label: 'Document à légaliser', desc: 'Document original revêtu de la signature du demandeur.', required: true, icon: '📄' }
					],
					frais: { montant: 500, unite: 'FCFA', par: 'copie (frais de timbre)' },
					direction: 'Toute Mairie',
					note: 'Les agents publics ne peuvent traiter des documents en langue étrangère non traduits en français.',
					cta: { label: 'Faire une demande en ligne', serviceType: 'legalisation' }
				}
			]
		},
		livret: {
			label: 'Livret de famille',
			icon: '📖',
			sections: [
				{
					id: 'inscription_livret',
					title: 'Inscription des enfants au livret de famille',
					subtitle: 'Enregistrer un enfant dans le livret',
					icon: '📖',
					urgent: false,
					delai: 'À préciser auprès de la mairie',
					delaiColor: 'gray',
					description: 'L\'inscription des enfants dans le livret de famille officialise leur rattachement à la famille et facilite les démarches administratives futures.',
					documents: [
						{ label: 'Livret de famille', desc: 'Le livret de famille original à mettre à jour.', required: true, icon: '📖' },
						{ label: 'Acte de naissance de l\'enfant', desc: 'Extrait d\'acte de naissance de l\'enfant à inscrire.', required: true, icon: '📄' }
					],
					frais: null,
					direction: 'Mairie du lieu de naissance de l\'enfant'
				},
				{
					id: 'duplicata_livret',
					title: 'Duplicata du livret de famille',
					subtitle: 'Obtenir un nouveau livret en cas de perte',
					icon: '📋',
					urgent: false,
					delai: 'À préciser auprès de la mairie',
					delaiColor: 'gray',
					description: 'En cas de perte ou de destruction du livret de famille, vous pouvez en demander un duplicata auprès de la mairie du lieu de mariage.',
					documents: [
						{ label: 'Copie de l\'acte de mariage ou ses références', desc: 'Pour permettre la reconstitution du livret.', required: true, icon: '💍' },
						{ label: 'Certificat de perte', desc: 'Délivré par la police ou la gendarmerie.', required: true, icon: '🚔' }
					],
					frais: { montant: 5500, unite: 'FCFA', par: 'duplicata' },
					direction: 'Mairie du lieu de mariage',
					cta: { label: 'Faire une demande en ligne', serviceType: 'duplicata_livret' }
				}
			]
		},
		certificats: {
			label: 'Certificats & Fiches',
			icon: '📋',
			sections: [
				{
					id: 'certificat_vie_entretien',
					title: 'Certificat de vie et entretien',
					subtitle: 'Attester qu\'un enfant est vivant et à charge',
					icon: '👨‍👩‍👧',
					urgent: false,
					delai: 'Quarante-huit (48) heures',
					delaiColor: 'green',
					description: 'Le certificat de vie permet aux administrations de vérifier le non-décès d\'un usager. Le certificat d\'entretien prouve qu\'un individu a, en charge, le ou les enfants dont les noms y figurent.',
					documents: [
						{ label: 'Photocopie de la CNI ou pièce à photo du parent / tuteur', desc: 'La pièce d\'identité du père, de la mère ou du tuteur légal.', required: true, icon: '🪪' },
						{ label: 'Extraits d\'actes de naissance des enfants (originaux)', desc: 'Datant de moins de trois (03) mois. Un par enfant concerné.', required: true, icon: '📄' }
					],
					frais: { montant: 1000, unite: 'FCFA', par: 'certificat' },
					direction: 'Mairie (Service de l\'État Civil)',
					note: 'Cible : le père, la mère ou le tuteur d\'un enfant mineur.',
					cta: { label: 'Faire une demande en ligne', serviceType: 'certificat_vie_entretien' }
				},
				{
					id: 'certificat_vie_adulte',
					title: 'Certificat de vie adulte',
					subtitle: 'Attester qu\'une personne retraitée est vivante',
					icon: '👴',
					urgent: false,
					delai: 'Quarante-huit (48) heures',
					delaiColor: 'green',
					description: 'Le certificat de vie adulte est un document qui permet aux administrations de vérifier le non-décès d\'une personne retraitée. La présence physique du demandeur est obligatoire.',
					documents: [
						{ label: 'Présence physique obligatoire', desc: 'Le demandeur doit se présenter en personne à la mairie.', required: true, icon: '🚶' },
						{ label: 'Photocopie de la pièce d\'identité', desc: 'CNI, passeport ou tout document officiel valide.', required: true, icon: '🪪' }
					],
					frais: { montant: 500, unite: 'FCFA', par: 'certificat' },
					direction: 'Mairie (Service de l\'État Civil)',
					note: 'Cible : personnes retraitées. La présence physique est indispensable.'
				},
				{
					id: 'fiche_familiale',
					title: 'Fiche familiale d\'état civil',
					subtitle: 'Récapitulatif des événements de la famille',
					icon: '👪',
					urgent: false,
					delai: 'Quarante-huit (48) heures',
					delaiColor: 'green',
					description: 'Écrit constatant les événements principaux de la vie d\'une famille, dressé sur un registre tenu par un officier d\'état civil.',
					documents: [
						{ label: 'Présence du déclarant (père ou mère)', desc: 'Le père ou la mère doit se présenter muni de la photocopie de sa pièce d\'identité.', required: true, icon: '🚶' },
						{ label: 'Extraits d\'actes de naissance des enfants', desc: 'Ou le livret de famille où sont enregistrés les enfants, en cas de mariage légal.', required: true, icon: '📄' }
					],
					frais: { montant: 5500, unite: 'FCFA', par: 'fiche' },
					direction: 'Mairie (Service de l\'État Civil)',
					cta: { label: 'Faire une demande en ligne', serviceType: 'fiche_familiale' }
				},
				{
					id: 'fiche_individuelle',
					title: 'Fiche individuelle d\'état civil',
					subtitle: 'Récapitulatif des événements d\'une personne',
					icon: '🙋',
					urgent: false,
					delai: 'Quarante-huit (48) heures',
					delaiColor: 'green',
					description: 'Écrit constatant les événements principaux de la vie d\'une personne, dressé sur un registre tenu par un officier d\'état civil.',
					documents: [
						{ label: 'Présence de l\'intéressé ou d\'un représentant', desc: 'L\'intéressé muni de son extrait d\'acte de naissance, ou toute autre personne munie de sa pièce d\'identité et de l\'extrait de naissance de l\'intéressé.', required: true, icon: '🚶' },
						{ label: 'Extrait d\'acte de naissance', desc: 'De la personne concernée par la fiche.', required: true, icon: '📄' }
					],
					frais: { montant: 5500, unite: 'FCFA', par: 'fiche' },
					direction: 'Mairie (Service de l\'État Civil)',
					cta: { label: 'Faire une demande en ligne', serviceType: 'fiche_individuelle' }
				}
			]
		}
	};

	const tabs = VALID_TABS;

	let openSections = {};
	function toggleSection(id) {
		openSections[id] = !openSections[id];
		openSections = { ...openSections };
	}

	$: currentDemarche = demarches[activeTab];
</script>

<svelte:head>
	<title>Guide des démarches – CiviCI</title>
</svelte:head>

<!-- Header -->
<header class="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
	<div class="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
		<a href="/" class="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
			</svg>
		</a>
		<div class="flex items-center gap-2">
			<div class="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
				<span class="text-white font-syne font-bold text-xs">C</span>
			</div>
			<span class="font-syne font-semibold text-primary-600">CiviCI</span>
		</div>
		<span class="text-gray-300">|</span>
		<span class="text-gray-600 text-sm font-medium">Guide des démarches</span>
	</div>
</header>

<!-- Hero -->
<section class="bg-gradient-to-br from-gray-800 to-gray-900 text-white py-10 px-4">
	<div class="max-w-4xl mx-auto">
		<div class="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 text-xs mb-4">
			<span class="w-1.5 h-1.5 bg-primary-400 rounded-full"></span>
			Informations officielles de la mairie
		</div>
		<h1 class="font-syne font-bold text-2xl sm:text-3xl mb-2">Guide des démarches d'état civil</h1>
		<p class="text-gray-300 max-w-xl">Retrouvez toutes les informations sur les documents requis, délais et frais pour chaque type de démarche.</p>
	</div>
</section>

<main class="max-w-4xl mx-auto px-4 sm:px-6 py-8">

	<!-- Tabs -->
	<div class="flex gap-2 mb-8 overflow-x-auto pb-1">
		{#each tabs as tab}
			{@const d = demarches[tab]}
			<button
				on:click={() => activeTab = tab}
				class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all
					{activeTab === tab
						? 'bg-primary-500 text-white shadow-md'
						: 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'}"
			>
				<span>{d.icon}</span>
				{d.label}
			</button>
		{/each}
	</div>

	<!-- Sections -->
	<div class="space-y-4">
		{#each currentDemarche.sections as section}
			<div class="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">

				<!-- Section header -->
				<button
					class="w-full p-5 text-left hover:bg-gray-50 transition-colors"
					on:click={() => toggleSection(section.id)}
				>
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-start gap-3">
							<div class="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
								{section.icon}
							</div>
							<div>
								<div class="flex items-center gap-2 flex-wrap">
									<h2 class="font-syne font-bold text-gray-800">{section.title}</h2>
									{#if section.urgent}
										<span class="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">Délai légal</span>
									{/if}
								</div>
								<p class="text-sm text-gray-500 mt-0.5">{section.subtitle}</p>
								<div class="flex items-center gap-1.5 mt-2">
									<svg class="w-4 h-4 {section.delaiColor === 'red' ? 'text-red-500' : section.delaiColor === 'gray' ? 'text-gray-400' : 'text-primary-500'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									<span class="text-xs font-medium {section.delaiColor === 'red' ? 'text-red-600' : section.delaiColor === 'gray' ? 'text-gray-500' : 'text-primary-600'}">
										{section.delai}
									</span>
								</div>
							</div>
						</div>
						<svg
							class="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform mt-1 {openSections[section.id] !== false ? 'rotate-180' : ''}"
							fill="none" viewBox="0 0 24 24" stroke="currentColor"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
						</svg>
					</div>
				</button>

				<!-- Section content (ouvert par défaut) -->
				{#if openSections[section.id] !== false}
					<div class="px-5 pb-5 border-t border-gray-50">

						{#if section.description}
							<p class="text-sm text-gray-600 mt-4 mb-4 leading-relaxed">{section.description}</p>
						{/if}

						<!-- Documents requis -->
						<div class="mb-4">
							<h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
								<svg class="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
								</svg>
								Documents à fournir
							</h3>
							<div class="space-y-2.5">
								{#each section.documents as doc}
									<div class="flex items-start gap-3 p-3 rounded-xl {doc.required ? 'bg-primary-50 border border-primary-100' : 'bg-gray-50 border border-gray-100'}">
										<span class="text-xl flex-shrink-0 mt-0.5">{doc.icon}</span>
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 flex-wrap">
												<span class="font-medium text-sm {doc.required ? 'text-primary-800' : 'text-gray-700'}">{doc.label}</span>
												<span class="text-xs px-1.5 py-0.5 rounded {doc.required ? 'bg-primary-200 text-primary-700' : 'bg-gray-200 text-gray-600'}">
													{doc.required ? 'Obligatoire' : 'Facultatif'}
												</span>
											</div>
											<p class="text-xs {doc.required ? 'text-primary-700' : 'text-gray-500'} mt-0.5 leading-relaxed">{doc.desc}</p>
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Frais -->
						{#if section.frais && section.frais.montant > 0}
							<div class="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3.5 mb-4">
								<span class="text-2xl">💰</span>
								<div>
									<p class="font-semibold text-amber-800 text-sm">Frais</p>
									<p class="text-amber-700 text-sm">
										<span class="font-bold text-base">{section.frais.montant.toLocaleString('fr-FR')} {section.frais.unite}</span>
										<span> par {section.frais.par}</span>
									</p>
								</div>
							</div>
						{:else}
							<div class="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl p-3.5 mb-4">
								<span class="text-2xl">✅</span>
								<div>
									<p class="font-semibold text-primary-800 text-sm">Démarche gratuite</p>
									<p class="text-primary-700 text-xs">Aucuns frais ne sont applicables pour cette démarche.</p>
								</div>
							</div>
						{/if}

						<!-- Direction -->
						{#if section.direction}
							<div class="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3.5 py-2.5 mb-4 border border-gray-100">
								<svg class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
								</svg>
								<span><strong class="text-gray-700">Direction :</strong> {section.direction}</span>
							</div>
						{/if}

						<!-- Note -->
						{#if section.note}
							<div class="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3.5 mb-4">
								<svg class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
								</svg>
								<p class="text-xs text-blue-700 leading-relaxed">{section.note}</p>
							</div>
						{/if}

						<!-- CTA -->
						{#if section.cta}
							<button
								on:click={() => goto('/demande', { state: { serviceType: section.cta.serviceType } })}
								class="btn-primary text-sm">
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
								</svg>
								{section.cta.label}
							</button>
						{:else}
							<a href="/suivi" class="btn-secondary text-sm">
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
								</svg>
								Contacter la mairie
							</a>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Contact info -->
	<div class="mt-8 bg-gray-800 text-white rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
		<div>
			<p class="font-syne font-semibold text-lg mb-1">Une question ?</p>
			<p class="text-gray-300 text-sm">Nos agents sont disponibles pour vous accompagner dans vos démarches.</p>
		</div>
		<a href="/demande" class="btn-accent whitespace-nowrap flex-shrink-0">
			Faire une demande en ligne
		</a>
	</div>

</main>
