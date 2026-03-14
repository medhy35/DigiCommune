<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { downloadAttestationDepotPDF } from '$lib/utils/pdf.js';
	import { toast } from '$lib/stores/toast.js';

	let currentStep = 1;
	let modules = {};
	let globalSettings = {};

	// OTP
	let otpSent = false;
	let otpVerified = false;
	let otpInput = '';
	let submitting = false;
	let submitted = false;
	let newDemande = null;
	let commune = null;

	// Document uploads
	let uploadedDocs = { cni: null, extrait: null };
	let uploadProgress = {};

	// Payment
	let paymentMode = ''; // 'online' | 'mairie'
	let mobileOperator = ''; // 'mtn' | 'orange'
	let mobilePhone = '';
	let paymentStep = 'choose'; // 'choose' | 'confirm' | 'done'
	let paymentCode = '';
	let paymentRef = '';
	let paymentProcessing = false;

	let form = {
		nom: '', prenom: '', date_naissance: '', cni: '', telephone: '',
		type_acte: '', concernant: '', numero_registre: '', date_evenement: '',
		personne_nom: '', personne_prenom: '', personne_date_naissance: '',
		copies: 1, mode_reception: 'retrait'
	};

	let errors = {};

	onMount(async () => {
		const [communeRes, settingsRes] = await Promise.all([
			fetch('/api/commune'),
			fetch('/api/settings?role=global')
		]);
		commune = await communeRes.json();
		if (settingsRes.ok) {
			const data = await settingsRes.json();
			globalSettings = data.settings || {};
			modules = globalSettings.modules || {};
		}
		// Type passé via navigation state (invisible dans l'URL)
		const typeFromState = $page.state?.serviceType;
		if (typeFromState && TYPE_LABELS[typeFromState] && modules[typeFromState] !== false) {
			form.type_acte = typeFromState;
		}
	});

	function sendOtp() {
		if (!form.telephone || form.telephone.length < 8) { errors.telephone = 'Numéro invalide.'; return; }
		otpSent = true; errors.telephone = '';
	}
	function verifyOtp() {
		if (otpInput.length === 4) { otpVerified = true; errors.otp = ''; }
		else errors.otp = 'Entrez un code à 4 chiffres.';
	}

	function handleFileUpload(field, event) {
		const file = event.target.files[0];
		if (!file) return;
		uploadProgress[field] = 0;
		uploadProgress = { ...uploadProgress };
		const reader = new FileReader();
		reader.onload = (e) => {
			let p = 0;
			const interval = setInterval(() => {
				p += 25;
				uploadProgress[field] = p;
				uploadProgress = { ...uploadProgress };
				if (p >= 100) {
					clearInterval(interval);
					uploadedDocs[field] = { name: file.name, size: file.size, type: file.type, preview: e.target.result };
					uploadedDocs = { ...uploadedDocs };
				}
			}, 80);
		};
		reader.readAsDataURL(file);
	}

	function removeDoc(field) {
		uploadedDocs[field] = null;
		uploadedDocs = { ...uploadedDocs };
		uploadProgress[field] = 0;
	}

	function formatFileSize(bytes) {
		if (bytes < 1024) return `${bytes} o`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} Ko`;
		return `${(bytes / 1048576).toFixed(1)} Mo`;
	}
	function isImage(doc) { return doc?.type?.startsWith('image/'); }

	function validateStep1() {
		errors = {};
		if (!form.nom.trim()) errors.nom = 'Requis.';
		if (!form.prenom.trim()) errors.prenom = 'Requis.';
		if (!form.date_naissance) errors.date_naissance = 'Requise.';
		if (!form.telephone.trim()) errors.telephone = 'Requis.';
		if (!otpVerified) errors.otp = 'Vérifiez votre numéro de téléphone.';
		return Object.keys(errors).length === 0;
	}

	function validateStep2() {
		errors = {};
		if (!form.type_acte) errors.type_acte = 'Choisissez un type.';
		if (ACTES_CIVILS.includes(form.type_acte)) {
			if (!form.concernant) errors.concernant = 'Choisissez qui est concerné.';
			if (form.concernant !== 'soi-meme') {
				if (!form.personne_nom.trim()) errors.personne_nom = 'Nom requis.';
				if (!form.personne_date_naissance) errors.personne_date_naissance = 'Date requise.';
			}
			if (!form.date_evenement) errors.date_evenement = 'La date est requise.';
		}
		if (!uploadedDocs.cni) errors.cni = 'Ce document est obligatoire.';
		if (isPerCopy && (!form.copies || form.copies < 1)) errors.copies = 'Min. 1 copie.';
		return Object.keys(errors).length === 0;
	}

	function validateStep3() {
		errors = {};
		if (!paymentMode) { errors.payment = 'Choisissez un mode de paiement.'; return false; }
		if (paymentMode === 'online' && paymentStep !== 'done') { errors.payment = 'Finalisez le paiement en ligne.'; return false; }
		return true;
	}

	function nextStep() {
		if (currentStep === 1 && !validateStep1()) return;
		if (currentStep === 2 && !validateStep2()) return;
		if (currentStep === 3 && !validateStep3()) return;
		currentStep++;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
	function prevStep() { currentStep--; window.scrollTo({ top: 0, behavior: 'smooth' }); }
	function goToStep(n) { currentStep = n; window.scrollTo({ top: 0, behavior: 'smooth' }); }

	let genAttestationLoading = false;
	async function genAttestation() {
		if (!newDemande || !commune) return;
		genAttestationLoading = true;
		try {
			await downloadAttestationDepotPDF(newDemande, commune);
			toast('Attestation de dépôt téléchargée');
		} catch(e) {
			toast('Erreur génération attestation', 'error');
		}
		genAttestationLoading = false;
	}

	function initiatePayment() {
		if (!mobileOperator) { errors.operator = 'Choisissez un opérateur.'; return; }
		if (!mobilePhone || mobilePhone.length < 8) { errors.mobilePhone = 'Numéro invalide.'; return; }
		errors = {};
		paymentProcessing = true;
		setTimeout(() => { paymentProcessing = false; paymentStep = 'confirm'; }, 1500);
	}

	function confirmPayment() {
		if (!paymentCode || paymentCode.length < 4) { errors.paymentCode = 'Code invalide.'; return; }
		paymentProcessing = true;
		setTimeout(() => {
			paymentRef = 'PAY-' + Math.random().toString(36).slice(2, 8).toUpperCase();
			paymentStep = 'done';
			paymentProcessing = false;
		}, 1200);
	}

	async function submitDemande() {
		submitting = true;
		try {
			const personConcernee = form.concernant === 'soi-meme'
				? { nom: form.nom, prenom: form.prenom, date_naissance: form.date_naissance, numero_registre: form.numero_registre, date_evenement: form.date_evenement }
				: { nom: form.personne_nom, prenom: form.personne_prenom, date_naissance: form.personne_date_naissance, numero_registre: form.numero_registre, date_evenement: form.date_evenement };

			const res = await fetch('/api/demandes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type_acte: form.type_acte,
					concernant: form.concernant,
					demandeur: { nom: form.nom, prenom: form.prenom, date_naissance: form.date_naissance, cni: form.cni, telephone: form.telephone },
					personne_concernee: personConcernee,
					copies: Number(form.copies),
					mode_reception: form.mode_reception,
					documents: [
						uploadedDocs.cni ? { type: 'cni', nom: uploadedDocs.cni.name, taille: uploadedDocs.cni.size, mimetype: uploadedDocs.cni.type, data: uploadedDocs.cni.preview } : null,
						uploadedDocs.extrait ? { type: 'extrait', nom: uploadedDocs.extrait.name, taille: uploadedDocs.extrait.size, mimetype: uploadedDocs.extrait.type, data: uploadedDocs.extrait.preview } : null
					].filter(Boolean),
					paiement: {
						mode: paymentMode,
						statut: paymentMode === 'online' ? 'paye' : 'en_attente',
						montant: montantTotal,
						reference: paymentRef || null,
						operateur: mobileOperator || null
					}
				})
			});
			if (res.ok) { newDemande = await res.json(); submitted = true; window.scrollTo({ top: 0, behavior: 'smooth' }); }
		} finally { submitting = false; }
	}

	const TYPE_LABELS = {
		naissance: 'Acte de naissance', mariage: 'Acte de mariage', deces: 'Acte de décès',
		attestation_concubinage: 'Attestation de concubinage',
		certification_documents: 'Certification de documents',
		legalisation: 'Légalisation',
		duplicata_livret: 'Duplicata du livret de famille',
		certificat_vie_entretien: 'Certificat de vie et entretien',
		fiche_familiale: 'Fiche familiale d\'état civil',
		fiche_individuelle: 'Fiche individuelle d\'état civil'
	};
	const TYPE_ICONS = {
		naissance: '👶', mariage: '💍', deces: '🕊️',
		attestation_concubinage: '🤝', certification_documents: '✅',
		legalisation: '🔏', duplicata_livret: '📋',
		certificat_vie_entretien: '👨‍👩‍👧', fiche_familiale: '👪', fiche_individuelle: '🙋'
	};
	const CONCERNANT_LABELS = { 'soi-meme': 'Vous-même', enfant: 'Un enfant', parent: 'Un parent' };
	const MODE_LABELS = { retrait: 'Retrait en mairie', whatsapp: 'PDF par WhatsApp' };
	const DATE_LABELS = { naissance: 'Date de naissance sur l\'acte', mariage: 'Date du mariage', deces: 'Date du décès' };

	// Services qui utilisent "acte civil" (concernant + date_evenement + registre)
	const ACTES_CIVILS = ['naissance', 'mariage', 'deces'];
	// Services facturés par copie
	const PER_COPY_SERVICES = ['naissance', 'mariage', 'deces', 'certification_documents'];

	$: fraisCopie   = globalSettings.frais_copie   ?? 500;
	$: fraisFixes   = globalSettings.frais_fixes   ?? {
		attestation_concubinage: 500, legalisation: 500,
		duplicata_livret: 5500, certificat_vie_entretien: 1000,
		fiche_familiale: 5500, fiche_individuelle: 5500
	};
	$: whatsappActif = globalSettings.whatsapp_actif !== false;
	$: slaHeures     = globalSettings.sla_heures_defaut ?? 48;

	$: isActeCivil = ACTES_CIVILS.includes(form.type_acte);
	$: isPerCopy   = PER_COPY_SERVICES.includes(form.type_acte);
	$: montantTotal = isPerCopy
		? form.copies * fraisCopie
		: (fraisFixes[form.type_acte] || 0);

	// Groupes de services pour le sélecteur (filtrés selon les modules actifs)
	const ALL_SERVICE_GROUPS = [
		{
			label: 'Actes civils', icon: '📄',
			services: [
				['naissance', '👶', 'Naissance'],
				['mariage', '💍', 'Mariage'],
				['deces', '🕊️', 'Décès']
			]
		},
		{
			label: 'Attestations & Légalisations', icon: '📜',
			services: [
				['attestation_concubinage', '🤝', 'Concubinage'],
				['legalisation', '🔏', 'Légalisation'],
				['certification_documents', '✅', 'Certification']
			]
		},
		{
			label: 'Livret de famille', icon: '📖',
			services: [
				['duplicata_livret', '📋', 'Duplicata livret']
			]
		},
		{
			label: 'Certificats & Fiches', icon: '🏛️',
			services: [
				['certificat_vie_entretien', '👨‍👩‍👧', 'Vie & entretien'],
				['fiche_familiale', '👪', 'Fiche familiale'],
				['fiche_individuelle', '🙋', 'Fiche individuelle']
			]
		}
	];

	$: SERVICE_GROUPS = ALL_SERVICE_GROUPS
		.map(g => ({ ...g, services: g.services.filter(([type]) => modules[type] !== false) }))
		.filter(g => g.services.length > 0);

	const DOCS_REQUIS = {
		naissance: [
			{ field: 'cni', label: 'Pièce d\'identité', hint: 'CNI, extrait de naissance, passeport ou certificat de nationalité', required: true },
			{ field: 'extrait', label: 'Copie extrait de naissance (si disponible)', hint: 'Facilite la recherche dans les registres', required: false }
		],
		mariage: [
			{ field: 'cni', label: 'Pièce d\'identité', hint: 'CNI, passeport ou document officiel valide', required: true },
			{ field: 'extrait', label: 'Acte de mariage (si disponible)', hint: 'Pour faciliter la recherche', required: false }
		],
		deces: [
			{ field: 'cni', label: 'Pièce d\'identité du demandeur', hint: 'CNI, passeport ou document officiel', required: true },
			{ field: 'extrait', label: 'Document du défunt (si disponible)', hint: 'Pour faciliter la recherche', required: false }
		],
		attestation_concubinage: [
			{ field: 'cni', label: 'Pièce d\'identité des deux concubins', hint: 'CNI, passeport ou carte de séjour (joindre les deux)', required: true },
			{ field: 'extrait', label: 'Attestation sur l\'honneur signée', hint: 'Lettre rédigée, datée et signée par les deux concubins', required: true }
		],
		certification_documents: [
			{ field: 'cni', label: 'Pièce d\'identité du demandeur', hint: 'CNI de l\'intéressé ou d\'un parent (père, mère, tuteur)', required: true },
			{ field: 'extrait', label: 'Document original à certifier', hint: 'L\'original est obligatoire pour comparer avec la photocopie', required: true }
		],
		legalisation: [
			{ field: 'cni', label: 'Pièce d\'identité du signataire', hint: 'CNI, passeport ou carte de séjour', required: true },
			{ field: 'extrait', label: 'Document à légaliser', hint: 'Document revêtu de la signature du demandeur', required: true }
		],
		duplicata_livret: [
			{ field: 'cni', label: 'Copie de l\'acte de mariage', hint: 'Ou les références de l\'acte (numéro, date, lieu)', required: true },
			{ field: 'extrait', label: 'Certificat de perte', hint: 'Délivré par la police ou la gendarmerie', required: true }
		],
		certificat_vie_entretien: [
			{ field: 'cni', label: 'Pièce d\'identité du parent / tuteur', hint: 'Photocopie de la CNI ou tout document avec photo', required: true },
			{ field: 'extrait', label: 'Extrait d\'acte de naissance des enfants', hint: 'Originaux de moins de 3 mois — un par enfant', required: true }
		],
		fiche_familiale: [
			{ field: 'cni', label: 'Pièce d\'identité du déclarant (père ou mère)', hint: 'Photocopie de la CNI ou pièce officielle', required: true },
			{ field: 'extrait', label: 'Extraits de naissance des enfants ou livret de famille', hint: 'En cas de mariage légal, le livret suffit', required: true }
		],
		fiche_individuelle: [
			{ field: 'cni', label: 'Pièce d\'identité', hint: 'De l\'intéressé ou de la personne qui fait la démarche', required: true },
			{ field: 'extrait', label: 'Extrait d\'acte de naissance de l\'intéressé', hint: 'De la personne concernée par la fiche', required: true }
		]
	};
	$: currentDocs = DOCS_REQUIS[form.type_acte] || DOCS_REQUIS.naissance;
</script>

<svelte:head>
	<title>Nouvelle demande – CiviCI</title>
</svelte:head>

<header class="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
	<div class="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
		<a href="/" class="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
			</svg>
		</a>
		<div class="flex items-center gap-2">
			{#if commune?.logo}
				<img src={commune.logo} alt={commune.nom_app || 'Logo'} class="w-7 h-7 rounded-lg object-contain" />
			{:else}
				<div class="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
					<span class="text-white font-syne font-bold text-xs">{(commune?.nom_app || 'C')[0]}</span>
				</div>
			{/if}
			<span class="font-syne font-semibold text-primary-600">{commune?.nom_app || 'CiviCI'}</span>
		</div>
		<span class="text-gray-200">|</span>
		<span class="text-gray-500 text-sm">Nouvelle demande</span>
	</div>
</header>

<main class="max-w-2xl mx-auto px-4 py-8">

{#if submitted && newDemande}
	<div class="text-center py-6">
		<div class="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-5">🎉</div>
		<h1 class="font-syne font-bold text-2xl text-gray-800 mb-2">Demande envoyée !</h1>
		<p class="text-gray-500 mb-7">Votre dossier a été enregistré. Un agent vous contactera dans les {slaHeures}h.</p>
		<div class="card mb-4">
			<p class="text-xs text-gray-400 mb-1">Numéro de dossier</p>
			<div class="flex items-center justify-center gap-2 mb-3">
				<span class="font-mono font-bold text-2xl text-primary-700 bg-primary-50 border border-primary-200 rounded-xl px-5 py-2">{newDemande.id}</span>
				<button on:click={() => navigator.clipboard?.writeText(newDemande.id)} class="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Copier">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
				</button>
			</div>
			<p class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">📌 Conservez ce numéro pour suivre votre demande.</p>
		</div>
		<div class="card mb-4 text-left">
			<h3 class="font-syne font-semibold text-gray-700 mb-3">Récapitulatif</h3>
			<dl class="space-y-2 text-sm">
				<div class="flex justify-between"><dt class="text-gray-500">Service</dt><dd class="font-medium">{TYPE_LABELS[newDemande.type_acte] || newDemande.type_acte}</dd></div>
				{#if newDemande.copies > 1 || PER_COPY_SERVICES.includes(newDemande.type_acte)}<div class="flex justify-between"><dt class="text-gray-500">Copies</dt><dd class="font-medium">{newDemande.copies}</dd></div>{/if}
				<div class="flex justify-between"><dt class="text-gray-500">Réception</dt><dd class="font-medium">{MODE_LABELS[newDemande.mode_reception]}</dd></div>
				<div class="flex justify-between border-t border-gray-100 pt-2">
					<dt class="text-gray-500">Paiement</dt>
					<dd class="font-medium">
						{#if newDemande.paiement?.statut === 'paye'}
							<span class="text-primary-600">✅ Payé — {newDemande.paiement.montant?.toLocaleString('fr-FR')} FCFA</span>
						{:else}
							<span class="text-amber-700">💵 À payer en mairie — {newDemande.paiement?.montant?.toLocaleString('fr-FR')} FCFA</span>
						{/if}
					</dd>
				</div>
				{#if newDemande.paiement?.reference}
					<div class="flex justify-between"><dt class="text-gray-500">Réf. paiement</dt><dd class="font-mono text-xs font-medium">{newDemande.paiement.reference}</dd></div>
				{/if}
			</dl>
		</div>
		<!-- Attestation de dépôt -->
		<button
			on:click={genAttestation}
			class="w-full flex items-center justify-center gap-2 mb-4 px-4 py-3 border-2 border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold rounded-xl transition-all"
			disabled={genAttestationLoading}
		>
			{#if genAttestationLoading}
				<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
				</svg>
			{:else}
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
				</svg>
			{/if}
			Télécharger mon attestation de dépôt
		</button>
		<p class="text-xs text-gray-400 text-center mb-4">Conservez ce document comme preuve de dépôt de votre demande.</p>
		<div class="flex flex-col sm:flex-row gap-3 justify-center">
			<button on:click={() => goto('/suivi', { state: { demande: newDemande } })} class="btn-primary">Suivre ma demande</button>
			<a href="/" class="btn-secondary">Retour à l'accueil</a>
		</div>
	</div>

{:else}
	<!-- STEPPER 4 étapes -->
	<div class="mb-8">
		<div class="flex items-center justify-center">
			{#each [1,2,3,4] as step}
				<div class="flex items-center">
					<div class="flex items-center gap-1.5">
						<div class="w-8 h-8 rounded-full flex items-center justify-center font-syne font-bold text-xs transition-all
							{currentStep === step ? 'bg-primary-500 text-white shadow-md shadow-primary-200' : currentStep > step ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}">
							{#if currentStep > step}
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
							{:else}
								{step}
							{/if}
						</div>
						<span class="text-xs font-medium hidden sm:block {currentStep === step ? 'text-primary-700' : currentStep > step ? 'text-primary-400' : 'text-gray-400'}">
							{['Identité','Demande','Paiement','Confirmation'][step-1]}
						</span>
					</div>
					{#if step < 4}
						<div class="w-8 sm:w-10 h-0.5 mx-1.5 {currentStep > step ? 'bg-primary-400' : 'bg-gray-200'}"></div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- ── STEP 1 : IDENTITÉ ── -->
	{#if currentStep === 1}
	<div class="card">
		<h2 class="font-syne font-bold text-xl text-gray-800 mb-1">Votre identité</h2>
		<p class="text-sm text-gray-500 mb-6">Ces informations permettent à nos agents de vous identifier et vous recontacter.</p>
		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="label" for="nom">Nom <span class="text-red-500">*</span></label>
					<input id="nom" type="text" bind:value={form.nom} class="input-field {errors.nom ? 'border-red-400' : ''}" placeholder="KONÉ"/>
					{#if errors.nom}<p class="text-xs text-red-500 mt-1">{errors.nom}</p>{/if}
				</div>
				<div>
					<label class="label" for="prenom">Prénom <span class="text-red-500">*</span></label>
					<input id="prenom" type="text" bind:value={form.prenom} class="input-field {errors.prenom ? 'border-red-400' : ''}" placeholder="Aminata"/>
					{#if errors.prenom}<p class="text-xs text-red-500 mt-1">{errors.prenom}</p>{/if}
				</div>
			</div>
			<div>
				<label class="label" for="dob">Date de naissance <span class="text-red-500">*</span></label>
				<input id="dob" type="date" bind:value={form.date_naissance} class="input-field {errors.date_naissance ? 'border-red-400' : ''}"/>
				{#if errors.date_naissance}<p class="text-xs text-red-500 mt-1">{errors.date_naissance}</p>{/if}
			</div>
			<div>
				<label class="label" for="cni_num">Numéro CNI <span class="text-gray-400 font-normal">(optionnel)</span></label>
				<input id="cni_num" type="text" bind:value={form.cni} class="input-field" placeholder="CI-XXXXXXXX"/>
			</div>
			<div>
				<label class="label" for="tel">Numéro de téléphone <span class="text-red-500">*</span></label>
				<div class="flex gap-2">
					<input id="tel" type="tel" bind:value={form.telephone} class="input-field flex-1 {errors.telephone ? 'border-red-400' : ''}" placeholder="+225 07 XX XX XX XX" disabled={otpVerified}/>
					{#if !otpVerified}
						<button type="button" on:click={sendOtp} class="btn-secondary text-sm py-2.5 whitespace-nowrap">{otpSent ? 'Renvoyer' : 'Envoyer le code'}</button>
					{/if}
				</div>
				{#if errors.telephone}<p class="text-xs text-red-500 mt-1">{errors.telephone}</p>{/if}
				{#if otpSent && !otpVerified}
					<div class="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
						<p class="text-sm text-blue-700 mb-2">Code envoyé au {form.telephone} <span class="text-blue-400 text-xs">(POC : tout code à 4 chiffres)</span></p>
						<div class="flex gap-2">
							<input type="text" bind:value={otpInput} maxlength="4" placeholder="_ _ _ _" class="input-field text-center font-mono text-xl tracking-widest w-32 {errors.otp ? 'border-red-400' : ''}"/>
							<button type="button" on:click={verifyOtp} class="btn-primary text-sm">Vérifier</button>
						</div>
						{#if errors.otp}<p class="text-xs text-red-500 mt-1">{errors.otp}</p>{/if}
					</div>
				{/if}
				{#if otpVerified}
					<p class="mt-2 text-sm text-primary-600 flex items-center gap-1.5">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
						Téléphone vérifié
					</p>
				{/if}
				{#if errors.otp && !otpSent}<p class="text-xs text-red-500 mt-1">{errors.otp}</p>{/if}
			</div>
		</div>
		<div class="mt-6 flex justify-end">
			<button on:click={nextStep} class="btn-primary">
				Continuer <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
			</button>
		</div>
	</div>
	{/if}

	<!-- ── STEP 2 : DEMANDE + DOCUMENTS ── -->
	{#if currentStep === 2}
	<div class="card">
		<h2 class="font-syne font-bold text-xl text-gray-800 mb-1">Votre demande</h2>
		<p class="text-sm text-gray-500 mb-6">Précisez l'acte souhaité et joignez vos justificatifs.</p>
		<div class="space-y-5">

			<div>
				<label class="label">Type de service <span class="text-red-500">*</span></label>
				<div class="space-y-3">
					{#each SERVICE_GROUPS as group}
						<div>
							<p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
								<span>{group.icon}</span>{group.label}
							</p>
							<div class="grid grid-cols-3 gap-2">
								{#each group.services as [val, icon, lbl]}
									<button type="button" on:click={() => { form.type_acte = val; form.concernant = ''; }}
										class="border-2 rounded-xl p-3 text-center transition-all
											{form.type_acte === val ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}">
										<div class="text-2xl mb-1">{icon}</div>
										<div class="text-xs font-medium leading-tight">{lbl}</div>
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>
				{#if errors.type_acte}<p class="text-xs text-red-500 mt-1">{errors.type_acte}</p>{/if}
			</div>

			{#if isActeCivil}
			<div>
				<label class="label">Concernant <span class="text-red-500">*</span></label>
				<div class="grid grid-cols-3 gap-3">
					{#each [['soi-meme','🙋','Moi-même'],['enfant','🧒','Mon enfant'],['parent','👴','Mon parent']] as [val, icon, lbl]}
						<button type="button" on:click={() => form.concernant = val}
							class="border-2 rounded-xl p-3 text-center transition-all
								{form.concernant === val ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}">
							<div class="text-2xl mb-1">{icon}</div>
							<div class="text-xs font-medium">{lbl}</div>
						</button>
					{/each}
				</div>
				{#if errors.concernant}<p class="text-xs text-red-500 mt-1">{errors.concernant}</p>{/if}
			</div>
			{/if}

			{#if isActeCivil && form.concernant && form.concernant !== 'soi-meme'}
				<div class="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
					<p class="text-sm font-medium text-gray-700">Personne concernée par l'acte</p>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label class="label text-xs" for="p_nom">Nom <span class="text-red-500">*</span></label>
							<input id="p_nom" type="text" bind:value={form.personne_nom} class="input-field text-sm {errors.personne_nom ? 'border-red-400' : ''}"/>
							{#if errors.personne_nom}<p class="text-xs text-red-500 mt-1">{errors.personne_nom}</p>{/if}
						</div>
						<div>
							<label class="label text-xs" for="p_prenom">Prénom</label>
							<input id="p_prenom" type="text" bind:value={form.personne_prenom} class="input-field text-sm"/>
						</div>
					</div>
					<div>
						<label class="label text-xs" for="p_dob">Date de naissance <span class="text-red-500">*</span></label>
						<input id="p_dob" type="date" bind:value={form.personne_date_naissance} class="input-field text-sm {errors.personne_date_naissance ? 'border-red-400' : ''}"/>
						{#if errors.personne_date_naissance}<p class="text-xs text-red-500 mt-1">{errors.personne_date_naissance}</p>{/if}
					</div>
				</div>
			{/if}

			{#if isActeCivil}
			<!-- Registre + Date de l'acte (actes civils uniquement) -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="label" for="registre">
						N° de registre
						<span class="ml-1 text-xs text-amber-600 font-normal bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">Recommandé</span>
					</label>
					<input id="registre" type="text" bind:value={form.numero_registre} class="input-field {!form.numero_registre ? 'border-amber-200' : ''}" placeholder="REG-XXXX-XXX"/>
					<p class="text-xs text-gray-400 mt-1">Accélère la recherche dans nos registres.</p>
				</div>
				<div>
					<label class="label" for="date_evt">
						{form.type_acte ? (DATE_LABELS[form.type_acte] || 'Date de l\'acte') : 'Date de l\'acte'} <span class="text-red-500">*</span>
					</label>
					<input id="date_evt" type="date" bind:value={form.date_evenement} class="input-field {errors.date_evenement ? 'border-red-400' : ''}"/>
					{#if errors.date_evenement}<p class="text-xs text-red-500 mt-1">{errors.date_evenement}</p>{/if}
				</div>
			</div>

			{#if !form.numero_registre && form.type_acte}
				<div class="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
					<svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
					Sans numéro de registre, le traitement peut prendre plus de temps. Indiquez-le si vous le connaissez.
				</div>
			{/if}
			{/if}

			<!-- Documents à joindre -->
			<div>
				<label class="label">Documents justificatifs</label>
				<div class="space-y-3">
					{#each currentDocs as doc}
						<div class="border-2 rounded-xl p-4 transition-all
							{uploadedDocs[doc.field] ? 'border-primary-200 bg-primary-50/40' : errors[doc.field] ? 'border-red-300 bg-red-50/40' : 'border-gray-200'}">
							<div class="flex items-center justify-between gap-2 mb-3">
								<div>
									<div class="flex items-center gap-2">
										<p class="text-sm font-medium text-gray-800">{doc.label}</p>
										<span class="text-xs px-1.5 py-0.5 rounded-full {doc.required ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}">
											{doc.required ? 'Obligatoire' : 'Facultatif'}
										</span>
									</div>
									<p class="text-xs text-gray-400 mt-0.5">{doc.hint}</p>
								</div>
							</div>

							{#if uploadedDocs[doc.field]}
								<div class="flex items-center gap-3 bg-white rounded-xl p-3 border border-primary-100">
									{#if isImage(uploadedDocs[doc.field])}
										<img src={uploadedDocs[doc.field].preview} alt="aperçu" class="w-12 h-12 object-cover rounded-lg flex-shrink-0"/>
									{:else}
										<div class="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">📄</div>
									{/if}
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-800 truncate">{uploadedDocs[doc.field].name}</p>
										<p class="text-xs text-gray-400">{formatFileSize(uploadedDocs[doc.field].size)}</p>
									</div>
									<button on:click={() => removeDoc(doc.field)} class="text-gray-400 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg">
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
									</button>
								</div>
							{:else if uploadProgress[doc.field] > 0 && uploadProgress[doc.field] < 100}
								<div>
									<div class="flex justify-between text-xs text-gray-500 mb-1.5"><span>Chargement...</span><span>{uploadProgress[doc.field]}%</span></div>
									<div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
										<div class="h-full bg-primary-500 rounded-full transition-all duration-100" style="width: {uploadProgress[doc.field]}%"></div>
									</div>
								</div>
							{:else}
								<label class="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-5 cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-all group
									{errors[doc.field] ? 'border-red-300' : 'border-gray-200'}">
									<svg class="w-8 h-8 text-gray-300 group-hover:text-primary-400 mb-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
									</svg>
									<span class="text-sm font-medium text-gray-500 group-hover:text-primary-600 transition-colors">Déposer ou cliquer pour choisir</span>
									<span class="text-xs text-gray-400 mt-1">Photo, scan JPG/PNG ou PDF — max 5 Mo</span>
									<input type="file" class="hidden" accept="image/*,application/pdf" on:change={(e) => handleFileUpload(doc.field, e)}/>
								</label>
							{/if}
							{#if errors[doc.field]}<p class="text-xs text-red-500 mt-1.5">{errors[doc.field]}</p>{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Copies + frais -->
			{#if isPerCopy}
			<div>
				<label class="label">Nombre de copies <span class="text-red-500">*</span></label>
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-3">
						<button type="button" on:click={() => form.copies = Math.max(1, form.copies - 1)} class="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 font-bold text-lg text-gray-600">−</button>
						<span class="w-10 text-center font-bold text-xl text-gray-800">{form.copies}</span>
						<button type="button" on:click={() => form.copies = Math.min(10, form.copies + 1)} class="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 font-bold text-lg text-gray-600">+</button>
					</div>
					<div class="flex-1 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
						<p class="text-xs text-amber-600">Frais de timbre</p>
						<p class="font-bold text-amber-800">{montantTotal.toLocaleString('fr-FR')} FCFA</p>
						<p class="text-xs text-amber-500">{fraisCopie.toLocaleString('fr-FR')} FCFA × {form.copies} copie{form.copies > 1 ? 's' : ''}</p>
					</div>
				</div>
				{#if errors.copies}<p class="text-xs text-red-500 mt-1">{errors.copies}</p>{/if}
			</div>
			{:else if montantTotal > 0}
			<div class="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
				<span class="text-2xl">💰</span>
				<div>
					<p class="text-xs text-amber-600">Frais</p>
					<p class="font-bold text-amber-800">{montantTotal.toLocaleString('fr-FR')} FCFA</p>
				</div>
			</div>
			{:else if form.type_acte}
			<div class="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl px-4 py-3">
				<span class="text-2xl">✅</span>
				<p class="text-sm text-primary-700 font-medium">Démarche gratuite</p>
			</div>
			{/if}

			<!-- Mode réception -->
			<div>
				<label class="label">Mode de réception <span class="text-red-500">*</span></label>
				<div class="grid gap-3" class:grid-cols-2={whatsappActif}>
					<button type="button" on:click={() => form.mode_reception = 'retrait'}
						class="border-2 rounded-xl p-4 text-left transition-all {form.mode_reception === 'retrait' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}">
						<div class="text-xl mb-1">🏛️</div>
						<div class="text-sm font-semibold {form.mode_reception === 'retrait' ? 'text-primary-700' : 'text-gray-700'}">Retrait en mairie</div>
						<div class="text-xs text-gray-500 mt-0.5">Venez récupérer votre acte</div>
					</button>
					{#if whatsappActif}
						<button type="button" on:click={() => form.mode_reception = 'whatsapp'}
							class="border-2 rounded-xl p-4 text-left transition-all {form.mode_reception === 'whatsapp' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}">
							<div class="text-xl mb-1">📱</div>
							<div class="text-sm font-semibold {form.mode_reception === 'whatsapp' ? 'text-primary-700' : 'text-gray-700'}">PDF par WhatsApp</div>
							<div class="text-xs text-gray-500 mt-0.5">Recevez le PDF sur votre téléphone</div>
						</button>
					{/if}
				</div>
			</div>
		</div>

		<div class="mt-6 flex justify-between">
			<button on:click={prevStep} class="btn-ghost">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
				Retour
			</button>
			<button on:click={nextStep} class="btn-primary">
				Continuer — Paiement
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
			</button>
		</div>
	</div>
	{/if}

	<!-- ── STEP 3 : PAIEMENT ── -->
	{#if currentStep === 3}
	<div class="card">
		<h2 class="font-syne font-bold text-xl text-gray-800 mb-1">Paiement des frais de timbre</h2>
		<p class="text-sm text-gray-500 mb-6">Choisissez comment régler les frais officiels.</p>

		<!-- Montant -->
		<div class="flex items-center justify-between bg-gray-50 rounded-2xl px-5 py-4 mb-6 border border-gray-100">
			<div>
				<p class="text-xs text-gray-400 mb-0.5">Montant à payer</p>
				<p class="font-syne font-bold text-3xl text-gray-800">{montantTotal.toLocaleString('fr-FR')} <span class="text-base font-normal text-gray-400">FCFA</span></p>
				<p class="text-xs text-gray-400 mt-0.5">
				{#if isPerCopy}{fraisCopie.toLocaleString('fr-FR')} FCFA × {form.copies} copie{form.copies > 1 ? 's' : ''} · {/if}
				{TYPE_ICONS[form.type_acte] || ''} {TYPE_LABELS[form.type_acte] || ''}
			</p>
			</div>
			<div class="text-4xl">🏦</div>
		</div>

		<div class="space-y-3 mb-5">
			<!-- Option 1 : Mobile Money -->
			<div class="border-2 rounded-2xl overflow-hidden transition-all {paymentMode === 'online' ? 'border-primary-400' : 'border-gray-200'}">
				<button
					type="button"
					on:click={() => { paymentMode = 'online'; }}
					class="w-full p-4 text-left hover:bg-gray-50 transition-colors"
				>
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">MM</div>
						<div class="flex-1">
							<p class="font-semibold text-gray-800 text-sm">Payer en ligne — Mobile Money</p>
							<p class="text-xs text-gray-500">MTN Mobile Money ou Orange Money · Immédiat</p>
						</div>
						<div class="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center {paymentMode === 'online' ? 'border-primary-500 bg-primary-500' : 'border-gray-300'}">
							{#if paymentMode === 'online'}<div class="w-2 h-2 bg-white rounded-full"></div>{/if}
						</div>
					</div>
				</button>

				{#if paymentMode === 'online'}
					<div class="border-t border-primary-100 p-4 bg-primary-50/30 space-y-4">
						{#if paymentStep === 'choose'}
							<div>
								<p class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Opérateur</p>
								<div class="grid grid-cols-2 gap-2">
									{#each [['mtn','🟡','MTN Mobile Money','#FFCC00'],['orange','🟠','Orange Money','#FF7900']] as [op, emoji, name, color]}
										<button type="button" on:click={() => { mobileOperator = op; errors.operator = ''; }}
											class="flex items-center gap-2 border-2 rounded-xl p-3 text-sm font-medium transition-all bg-white
												{mobileOperator === op ? 'border-primary-500 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}">
											<span class="text-xl">{emoji}</span> {name}
										</button>
									{/each}
								</div>
								{#if errors.operator}<p class="text-xs text-red-500 mt-1">{errors.operator}</p>{/if}
							</div>
							<div>
								<p class="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
									Numéro {mobileOperator === 'mtn' ? 'MTN' : mobileOperator === 'orange' ? 'Orange' : 'Mobile Money'}
								</p>
								<input type="tel" bind:value={mobilePhone} class="input-field text-sm bg-white {errors.mobilePhone ? 'border-red-400' : ''}" placeholder="+225 07 XX XX XX XX"/>
								{#if errors.mobilePhone}<p class="text-xs text-red-500 mt-1">{errors.mobilePhone}</p>{/if}
							</div>
							<button type="button" on:click={initiatePayment}
								class="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
								disabled={paymentProcessing}>
								{#if paymentProcessing}
									<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
									Connexion en cours...
								{:else}
									💸 Payer {montantTotal.toLocaleString('fr-FR')} FCFA maintenant
								{/if}
							</button>

						{:else if paymentStep === 'confirm'}
							<div class="bg-white rounded-xl p-4 border border-primary-200">
								<p class="text-sm text-gray-700 mb-3">
									Une demande de paiement de <strong>{montantTotal.toLocaleString('fr-FR')} FCFA</strong> a été envoyée au <strong>{mobilePhone}</strong>. Confirmez en entrant le code reçu par SMS.
								</p>
								<p class="text-xs font-semibold text-gray-600 mb-1.5">Code de confirmation <span class="text-gray-400 font-normal">(POC : tout code à 4 chiffres)</span></p>
								<div class="flex gap-2">
									<input type="text" bind:value={paymentCode} maxlength="6" placeholder="_ _ _ _"
										class="input-field text-center font-mono text-xl tracking-widest flex-1 {errors.paymentCode ? 'border-red-400' : ''}"/>
									<button type="button" on:click={confirmPayment} class="btn-primary text-sm whitespace-nowrap" disabled={paymentProcessing}>
										{#if paymentProcessing}
											<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
										{:else}
											Confirmer
										{/if}
									</button>
								</div>
								{#if errors.paymentCode}<p class="text-xs text-red-500 mt-1">{errors.paymentCode}</p>{/if}
							</div>

						{:else if paymentStep === 'done'}
							<div class="flex items-center gap-3 bg-white border border-primary-200 rounded-xl p-4">
								<div class="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0">✓</div>
								<div>
									<p class="font-semibold text-primary-800">Paiement confirmé !</p>
									<p class="text-sm text-primary-600 font-mono">{paymentRef} · {montantTotal.toLocaleString('fr-FR')} FCFA</p>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Option 2 : Payer en mairie -->
			<button type="button" on:click={() => { paymentMode = 'mairie'; }}
				class="w-full border-2 rounded-2xl p-4 text-left transition-all {paymentMode === 'mairie' ? 'border-gray-500 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🏛️</div>
					<div class="flex-1">
						<p class="font-semibold text-gray-800 text-sm">Payer au retrait en mairie</p>
						<p class="text-xs text-gray-500">Réglez les {montantTotal.toLocaleString('fr-FR')} FCFA directement au guichet lors du retrait de votre acte.</p>
					</div>
					<div class="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center {paymentMode === 'mairie' ? 'border-gray-600 bg-gray-600' : 'border-gray-300'}">
						{#if paymentMode === 'mairie'}<div class="w-2 h-2 bg-white rounded-full"></div>{/if}
					</div>
				</div>
				{#if paymentMode === 'mairie'}
					<p class="mt-3 text-xs text-gray-500 pl-13">Munissez-vous de <strong>{montantTotal.toLocaleString('fr-FR')} FCFA</strong> en espèces ou par Mobile Money au guichet.</p>
				{/if}
			</button>
		</div>

		{#if errors.payment}<p class="text-xs text-red-500 mb-3">{errors.payment}</p>{/if}

		<div class="flex justify-between">
			<button on:click={prevStep} class="btn-ghost">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
				Retour
			</button>
			<button on:click={nextStep} class="btn-primary">
				Récapitulatif
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
			</button>
		</div>
	</div>
	{/if}

	<!-- ── STEP 4 : CONFIRMATION ── -->
	{#if currentStep === 4}
	<div class="card">
		<h2 class="font-syne font-bold text-xl text-gray-800 mb-1">Récapitulatif final</h2>
		<p class="text-sm text-gray-500 mb-6">Vérifiez tout avant d'envoyer.</p>
		<div class="space-y-3">
			<div class="bg-gray-50 rounded-xl p-4">
				<div class="flex items-center justify-between mb-2.5">
					<h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Identité</h3>
					<button on:click={() => goToStep(1)} class="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1 hover:underline">✏️ Modifier</button>
				</div>
				<dl class="space-y-1.5 text-sm">
					<div class="flex justify-between"><dt class="text-gray-500">Nom complet</dt><dd class="font-medium">{form.prenom} {form.nom}</dd></div>
					<div class="flex justify-between"><dt class="text-gray-500">Téléphone</dt><dd class="font-medium">{form.telephone} ✅</dd></div>
				</dl>
			</div>
			<div class="bg-gray-50 rounded-xl p-4">
				<div class="flex items-center justify-between mb-2.5">
					<h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Demande</h3>
					<button on:click={() => goToStep(2)} class="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1 hover:underline">✏️ Modifier</button>
				</div>
				<dl class="space-y-1.5 text-sm">
					<div class="flex justify-between"><dt class="text-gray-500">Service</dt><dd class="font-medium">{TYPE_LABELS[form.type_acte] || '—'}</dd></div>
					{#if isActeCivil}
					<div class="flex justify-between"><dt class="text-gray-500">Concernant</dt><dd class="font-medium">{CONCERNANT_LABELS[form.concernant] || '—'}</dd></div>
					<div class="flex justify-between"><dt class="text-gray-500">Date de l'acte</dt><dd class="font-medium">{form.date_evenement}</dd></div>
					{#if form.numero_registre}<div class="flex justify-between"><dt class="text-gray-500">N° registre</dt><dd class="font-mono text-xs font-medium">{form.numero_registre}</dd></div>{/if}
					{/if}
					{#if isPerCopy}<div class="flex justify-between"><dt class="text-gray-500">Copies</dt><dd class="font-medium">{form.copies}</dd></div>{/if}
					<div class="flex justify-between"><dt class="text-gray-500">Réception</dt><dd class="font-medium">{MODE_LABELS[form.mode_reception]}</dd></div>
				</dl>
			</div>
			{#if uploadedDocs.cni || uploadedDocs.extrait}
				<div class="bg-gray-50 rounded-xl p-4">
					<h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Documents joints</h3>
					<ul class="space-y-1.5 text-sm">
						{#if uploadedDocs.cni}<li class="flex items-center gap-2 text-gray-700"><svg class="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Pièce d'identité : {uploadedDocs.cni.name}</li>{/if}
						{#if uploadedDocs.extrait}<li class="flex items-center gap-2 text-gray-700"><svg class="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Extrait : {uploadedDocs.extrait.name}</li>{/if}
					</ul>
				</div>
			{/if}
			<div class="bg-gray-50 rounded-xl p-4">
				<div class="flex items-center justify-between mb-2.5">
					<h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Paiement</h3>
					<button on:click={() => goToStep(3)} class="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1 hover:underline">✏️ Modifier</button>
				</div>
				<div class="flex justify-between text-sm"><dt class="text-gray-500">Montant</dt><dd class="font-bold">{montantTotal.toLocaleString('fr-FR')} FCFA</dd></div>
				<div class="flex justify-between text-sm mt-1.5">
					<dt class="text-gray-500">Mode</dt>
					<dd class="font-medium {paymentMode === 'online' ? 'text-primary-600' : 'text-gray-700'}">
						{paymentMode === 'online' ? `✅ Payé · Réf. ${paymentRef}` : '🏛️ À payer en mairie'}
					</dd>
				</div>
			</div>
			<div class="flex items-start gap-2.5 bg-primary-50 border border-primary-200 rounded-xl p-3.5 text-sm text-primary-800">
				<svg class="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
				Un agent vous contactera au <strong>{form.telephone}</strong> dans les <strong>24h</strong>.
			</div>
		</div>
		<div class="mt-6 flex flex-col sm:flex-row justify-between gap-3">
			<button on:click={prevStep} class="btn-ghost">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
				Modifier
			</button>
			<button on:click={submitDemande} class="btn-accent" disabled={submitting}>
				{#if submitting}
					<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
					Envoi...
				{:else}
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
					Envoyer ma demande
				{/if}
			</button>
		</div>
	</div>
	{/if}

{/if}
</main>
