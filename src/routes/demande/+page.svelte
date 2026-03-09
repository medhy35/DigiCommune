<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let currentStep = 1;
	let otpSent = false;
	let otpVerified = false;
	let otpCode = '';
	let otpInput = '';
	let submitting = false;
	let submitted = false;
	let newDemande = null;
	let commune = null;

	// Form data
	let form = {
		// Step 1
		nom: '',
		prenom: '',
		date_naissance: '',
		cni: '',
		telephone: '',
		// Step 2
		type_acte: '',
		concernant: '',
		numero_registre: '',
		personne_nom: '',
		personne_prenom: '',
		personne_date_naissance: '',
		copies: 1,
		mode_reception: 'retrait'
	};

	let errors = {};

	onMount(async () => {
		const typeFromUrl = $page.url.searchParams.get('type');
		if (typeFromUrl) form.type_acte = typeFromUrl;
		const res = await fetch('/api/commune');
		commune = await res.json();
	});

	function sendOtp() {
		if (!form.telephone || form.telephone.length < 8) {
			errors.telephone = 'Veuillez entrer un numéro valide.';
			return;
		}
		otpSent = true;
		otpCode = '1234'; // Simulated OTP
		errors.telephone = '';
	}

	function verifyOtp() {
		if (otpInput === otpCode || otpInput.length === 4) {
			otpVerified = true;
			errors.otp = '';
		} else {
			errors.otp = 'Code incorrect. (Indice : entrez n\'importe quel code à 4 chiffres pour ce POC)';
		}
	}

	function validateStep1() {
		errors = {};
		if (!form.nom.trim()) errors.nom = 'Le nom est requis.';
		if (!form.prenom.trim()) errors.prenom = 'Le prénom est requis.';
		if (!form.date_naissance) errors.date_naissance = 'La date de naissance est requise.';
		if (!form.telephone.trim()) errors.telephone = 'Le numéro de téléphone est requis.';
		if (!otpVerified) errors.otp = 'Veuillez vérifier votre numéro de téléphone.';
		return Object.keys(errors).length === 0;
	}

	function validateStep2() {
		errors = {};
		if (!form.type_acte) errors.type_acte = 'Veuillez choisir un type d\'acte.';
		if (!form.concernant) errors.concernant = 'Veuillez préciser qui est concerné.';
		if (form.concernant !== 'soi-meme' && !form.numero_registre) {
			if (!form.personne_nom.trim()) errors.personne_nom = 'Le nom est requis si pas de numéro de registre.';
			if (!form.personne_date_naissance) errors.personne_date_naissance = 'La date de naissance est requise.';
		}
		if (!form.copies || form.copies < 1) errors.copies = 'Au moins 1 copie.';
		return Object.keys(errors).length === 0;
	}

	function nextStep() {
		if (currentStep === 1 && !validateStep1()) return;
		if (currentStep === 2 && !validateStep2()) return;
		currentStep++;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function prevStep() {
		currentStep--;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	async function submitDemande() {
		submitting = true;
		try {
			const personConcernee = form.concernant === 'soi-meme'
				? { nom: form.nom, prenom: form.prenom, date_naissance: form.date_naissance, numero_registre: form.numero_registre }
				: { nom: form.personne_nom, prenom: form.personne_prenom, date_naissance: form.personne_date_naissance, numero_registre: form.numero_registre };

			const res = await fetch('/api/demandes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type_acte: form.type_acte,
					concernant: form.concernant,
					demandeur: {
						nom: form.nom,
						prenom: form.prenom,
						date_naissance: form.date_naissance,
						cni: form.cni,
						telephone: form.telephone
					},
					personne_concernee: personConcernee,
					copies: Number(form.copies),
					mode_reception: form.mode_reception
				})
			});

			if (res.ok) {
				newDemande = await res.json();
				submitted = true;
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}
		} catch (e) {
			console.error(e);
		} finally {
			submitting = false;
		}
	}

	const TYPE_LABELS = { naissance: 'Acte de naissance', mariage: 'Acte de mariage', deces: 'Acte de décès' };
	const CONCERNANT_LABELS = { 'soi-meme': 'Vous-même', enfant: 'Un enfant', parent: 'Un parent' };
	const MODE_LABELS = { retrait: 'Retrait en mairie', whatsapp: 'PDF par WhatsApp' };
</script>

<svelte:head>
	<title>Nouvelle demande – CiviCI</title>
</svelte:head>

<!-- Header minimal -->
<header class="bg-white border-b border-gray-100 shadow-sm">
	<div class="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
		<a href="/" class="text-gray-400 hover:text-gray-600 transition-colors">
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
		<span class="text-gray-600 text-sm">Nouvelle demande</span>
	</div>
</header>

<main class="max-w-2xl mx-auto px-4 py-8">

{#if submitted && newDemande}
	<!-- SUCCESS STATE -->
	<div class="text-center py-8">
		<div class="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-6 animate-bounce">🎉</div>
		<h1 class="font-syne font-bold text-2xl text-gray-800 mb-2">Demande envoyée !</h1>
		<p class="text-gray-500 mb-8">Votre demande a bien été enregistrée. Un agent vous contactera dans les 24 heures.</p>

		<div class="card mb-6 text-left">
			<div class="text-center mb-4">
				<p class="text-sm text-gray-500 mb-1">Votre numéro de dossier</p>
				<div class="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-xl px-6 py-3">
					<span class="font-mono font-bold text-2xl text-primary-700">{newDemande.id}</span>
					<button on:click={() => navigator.clipboard?.writeText(newDemande.id)} class="text-primary-400 hover:text-primary-600">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
						</svg>
					</button>
				</div>
			</div>
			<div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
				<strong>Important :</strong> Notez bien ce numéro. Il vous permettra de suivre l'avancement de votre demande.
			</div>
		</div>

		<div class="card mb-6 text-left">
			<h3 class="font-syne font-semibold text-gray-700 mb-3">Récapitulatif</h3>
			<dl class="space-y-2 text-sm">
				<div class="flex justify-between"><dt class="text-gray-500">Type d'acte</dt><dd class="font-medium">{TYPE_LABELS[newDemande.type_acte]}</dd></div>
				<div class="flex justify-between"><dt class="text-gray-500">Concernant</dt><dd class="font-medium">{CONCERNANT_LABELS[newDemande.concernant]}</dd></div>
				<div class="flex justify-between"><dt class="text-gray-500">Nombre de copies</dt><dd class="font-medium">{newDemande.copies}</dd></div>
				<div class="flex justify-between"><dt class="text-gray-500">Mode de réception</dt><dd class="font-medium">{MODE_LABELS[newDemande.mode_reception]}</dd></div>
			</dl>
		</div>

		<div class="flex flex-col sm:flex-row gap-3 justify-center">
			<a href="/suivi/{newDemande.id}" class="btn-primary">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
				</svg>
				Suivre ma demande
			</a>
			<a href="/" class="btn-secondary">Retour à l'accueil</a>
		</div>
	</div>

{:else}
	<!-- STEPPER -->
	<div class="mb-8">
		<div class="flex items-center justify-center gap-0">
			{#each [1, 2, 3] as step}
				<div class="flex items-center">
					<div class="flex items-center gap-2">
						<div class="w-9 h-9 rounded-full flex items-center justify-center font-syne font-bold text-sm transition-all
							{currentStep === step ? 'bg-primary-500 text-white shadow-md shadow-primary-200' : currentStep > step ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}">
							{#if currentStep > step}
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
								</svg>
							{:else}
								{step}
							{/if}
						</div>
						<span class="text-sm font-medium hidden sm:block
							{currentStep === step ? 'text-primary-700' : currentStep > step ? 'text-primary-500' : 'text-gray-400'}">
							{['Votre identité', 'Votre demande', 'Confirmation'][step - 1]}
						</span>
					</div>
					{#if step < 3}
						<div class="w-12 sm:w-16 h-0.5 mx-2 {currentStep > step ? 'bg-primary-400' : 'bg-gray-200'}"></div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- STEP 1 -->
	{#if currentStep === 1}
		<div class="card">
			<h2 class="font-syne font-bold text-xl text-gray-800 mb-1">Qui êtes-vous ?</h2>
			<p class="text-sm text-gray-500 mb-6">Ces informations permettent à nos agents de vous identifier et de vous recontacter.</p>

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
					<label class="label" for="cni">Numéro CNI <span class="text-gray-400 font-normal">(optionnel)</span></label>
					<input id="cni" type="text" bind:value={form.cni} class="input-field" placeholder="CI-XXXXXXXX"/>
				</div>

				<div>
					<label class="label" for="tel">Numéro de téléphone <span class="text-red-500">*</span></label>
					<div class="flex gap-2">
						<input id="tel" type="tel" bind:value={form.telephone} class="input-field flex-1 {errors.telephone ? 'border-red-400' : ''}" placeholder="+225 07 XX XX XX XX" disabled={otpVerified}/>
						{#if !otpVerified}
							<button type="button" on:click={sendOtp} class="btn-secondary whitespace-nowrap text-sm py-2.5">
								{otpSent ? 'Renvoyer' : 'Envoyer le code'}
							</button>
						{/if}
					</div>
					{#if errors.telephone}<p class="text-xs text-red-500 mt-1">{errors.telephone}</p>{/if}

					{#if otpSent && !otpVerified}
						<div class="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
							<p class="text-sm text-blue-700 mb-2">
								Code envoyé au {form.telephone}
								<span class="font-normal text-blue-500">(POC : entrez n'importe quel code à 4 chiffres)</span>
							</p>
							<div class="flex gap-2">
								<input
									type="text"
									bind:value={otpInput}
									maxlength="4"
									placeholder="_ _ _ _"
									class="input-field text-center font-mono text-xl tracking-widest w-36 {errors.otp ? 'border-red-400' : ''}"
								/>
								<button type="button" on:click={verifyOtp} class="btn-primary text-sm">Vérifier</button>
							</div>
							{#if errors.otp}<p class="text-xs text-red-500 mt-1">{errors.otp}</p>{/if}
						</div>
					{/if}

					{#if otpVerified}
						<div class="mt-2 flex items-center gap-2 text-sm text-primary-600">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
							Téléphone vérifié
						</div>
					{/if}

					{#if errors.otp && !otpSent}
						<p class="text-xs text-red-500 mt-1">{errors.otp}</p>
					{/if}
				</div>
			</div>

			<div class="mt-6 flex justify-end">
				<button on:click={nextStep} class="btn-primary">
					Continuer
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- STEP 2 -->
	{#if currentStep === 2}
		<div class="card">
			<h2 class="font-syne font-bold text-xl text-gray-800 mb-1">Votre demande</h2>
			<p class="text-sm text-gray-500 mb-6">Précisez le type d'acte dont vous avez besoin et les informations de la personne concernée.</p>

			<div class="space-y-5">
				<!-- Type d'acte -->
				<div>
					<label class="label">Type d'acte <span class="text-red-500">*</span></label>
					<div class="grid grid-cols-3 gap-3">
						{#each [['naissance', '👶', 'Naissance'], ['mariage', '💍', 'Mariage'], ['deces', '🕊️', 'Décès']] as [val, icon, lbl]}
							<button
								type="button"
								on:click={() => form.type_acte = val}
								class="border-2 rounded-xl p-3 text-center transition-all
									{form.type_acte === val ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}"
							>
								<div class="text-2xl mb-1">{icon}</div>
								<div class="text-xs font-medium">{lbl}</div>
							</button>
						{/each}
					</div>
					{#if errors.type_acte}<p class="text-xs text-red-500 mt-1">{errors.type_acte}</p>{/if}
				</div>

				<!-- Concernant -->
				<div>
					<label class="label">Concernant <span class="text-red-500">*</span></label>
					<div class="grid grid-cols-3 gap-3">
						{#each [['soi-meme', '🙋', 'Moi-même'], ['enfant', '🧒', 'Mon enfant'], ['parent', '👴', 'Mon parent']] as [val, icon, lbl]}
							<button
								type="button"
								on:click={() => { form.concernant = val; }}
								class="border-2 rounded-xl p-3 text-center transition-all
									{form.concernant === val ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'}"
							>
								<div class="text-2xl mb-1">{icon}</div>
								<div class="text-xs font-medium">{lbl}</div>
							</button>
						{/each}
					</div>
					{#if errors.concernant}<p class="text-xs text-red-500 mt-1">{errors.concernant}</p>{/if}
				</div>

				<!-- Numero de registre -->
				<div>
					<label class="label" for="registre">
						Numéro de registre
						<span class="text-gray-400 font-normal">(optionnel)</span>
						<button
							type="button"
							class="ml-1 text-gray-400 hover:text-gray-600 inline-flex items-center"
							title="Laissez vide si vous ne l'avez pas. Nos agents feront la recherche."
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
							</svg>
						</button>
					</label>
					<input id="registre" type="text" bind:value={form.numero_registre} class="input-field" placeholder="Ex : REG-2020-456 — Laissez vide si vous ne l'avez pas"/>
					<p class="text-xs text-gray-400 mt-1">Laissez vide si vous ne l'avez pas. Nos agents feront la recherche dans les registres.</p>
				</div>

				<!-- Personne concernée (si pas soi-même) -->
				{#if form.concernant && form.concernant !== 'soi-meme'}
					<div class="bg-gray-50 rounded-xl p-4 space-y-4 border border-gray-100">
						<p class="text-sm font-medium text-gray-700">Informations sur la personne concernée</p>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="label text-xs" for="p_nom">Nom <span class="text-red-500">*</span></label>
								<input id="p_nom" type="text" bind:value={form.personne_nom} class="input-field text-sm {errors.personne_nom ? 'border-red-400' : ''}" placeholder="Nom"/>
								{#if errors.personne_nom}<p class="text-xs text-red-500 mt-1">{errors.personne_nom}</p>{/if}
							</div>
							<div>
								<label class="label text-xs" for="p_prenom">Prénom</label>
								<input id="p_prenom" type="text" bind:value={form.personne_prenom} class="input-field text-sm" placeholder="Prénom"/>
							</div>
						</div>
						<div>
							<label class="label text-xs" for="p_dob">Date de naissance <span class="text-red-500">*</span></label>
							<input id="p_dob" type="date" bind:value={form.personne_date_naissance} class="input-field text-sm {errors.personne_date_naissance ? 'border-red-400' : ''}"/>
							{#if errors.personne_date_naissance}<p class="text-xs text-red-500 mt-1">{errors.personne_date_naissance}</p>{/if}
						</div>
					</div>
				{/if}

				<!-- Copies -->
				<div>
					<label class="label" for="copies">Nombre de copies souhaitées <span class="text-red-500">*</span></label>
					<div class="flex items-center gap-3">
						<button type="button" on:click={() => form.copies = Math.max(1, form.copies - 1)} class="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 font-bold text-lg">−</button>
						<span class="w-12 text-center font-bold text-xl text-gray-800">{form.copies}</span>
						<button type="button" on:click={() => form.copies = Math.min(10, form.copies + 1)} class="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 font-bold text-lg">+</button>
					</div>
					{#if errors.copies}<p class="text-xs text-red-500 mt-1">{errors.copies}</p>{/if}
				</div>

				<!-- Mode de réception -->
				<div>
					<label class="label">Mode de réception <span class="text-red-500">*</span></label>
					<div class="grid grid-cols-2 gap-3">
						{#each [['retrait', '🏛️', 'Retrait en mairie', 'Venez récupérer votre acte en mairie'], ['whatsapp', '📱', 'PDF par WhatsApp', 'Recevez votre acte en PDF sur WhatsApp']] as [val, icon, lbl, desc]}
							<button
								type="button"
								on:click={() => form.mode_reception = val}
								class="border-2 rounded-xl p-4 text-left transition-all
									{form.mode_reception === val ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}"
							>
								<div class="text-xl mb-1">{icon}</div>
								<div class="text-sm font-semibold {form.mode_reception === val ? 'text-primary-700' : 'text-gray-700'}">{lbl}</div>
								<div class="text-xs text-gray-500 mt-0.5">{desc}</div>
							</button>
						{/each}
					</div>
				</div>
			</div>

			<div class="mt-6 flex justify-between">
				<button on:click={prevStep} class="btn-ghost">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
					</svg>
					Retour
				</button>
				<button on:click={nextStep} class="btn-primary">
					Vérifier ma demande
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<!-- STEP 3 -->
	{#if currentStep === 3}
		<div class="card">
			<h2 class="font-syne font-bold text-xl text-gray-800 mb-1">Récapitulatif</h2>
			<p class="text-sm text-gray-500 mb-6">Vérifiez vos informations avant de soumettre votre demande.</p>

			<div class="space-y-4">
				<div class="bg-gray-50 rounded-xl p-4">
					<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Votre identité</h3>
					<dl class="space-y-2 text-sm">
						<div class="flex justify-between"><dt class="text-gray-500">Nom complet</dt><dd class="font-medium">{form.prenom} {form.nom}</dd></div>
						<div class="flex justify-between"><dt class="text-gray-500">Date de naissance</dt><dd class="font-medium">{form.date_naissance}</dd></div>
						<div class="flex justify-between"><dt class="text-gray-500">Téléphone</dt><dd class="font-medium">{form.telephone} ✅</dd></div>
						{#if form.cni}<div class="flex justify-between"><dt class="text-gray-500">CNI</dt><dd class="font-medium">{form.cni}</dd></div>{/if}
					</dl>
				</div>

				<div class="bg-gray-50 rounded-xl p-4">
					<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Votre demande</h3>
					<dl class="space-y-2 text-sm">
						<div class="flex justify-between"><dt class="text-gray-500">Type d'acte</dt><dd class="font-medium">{TYPE_LABELS[form.type_acte] || '—'}</dd></div>
						<div class="flex justify-between"><dt class="text-gray-500">Concernant</dt><dd class="font-medium">{CONCERNANT_LABELS[form.concernant] || '—'}</dd></div>
						{#if form.concernant !== 'soi-meme' && form.personne_nom}
							<div class="flex justify-between"><dt class="text-gray-500">Personne concernée</dt><dd class="font-medium">{form.personne_prenom} {form.personne_nom}</dd></div>
						{/if}
						{#if form.numero_registre}
							<div class="flex justify-between"><dt class="text-gray-500">N° de registre</dt><dd class="font-medium font-mono">{form.numero_registre}</dd></div>
						{/if}
						<div class="flex justify-between"><dt class="text-gray-500">Copies</dt><dd class="font-medium">{form.copies}</dd></div>
						<div class="flex justify-between"><dt class="text-gray-500">Réception</dt><dd class="font-medium">{MODE_LABELS[form.mode_reception]}</dd></div>
					</dl>
				</div>

				<div class="bg-primary-50 border border-primary-200 rounded-xl p-4 flex gap-3">
					<svg class="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<p class="text-sm text-primary-800">Un agent de la mairie vous contactera au <strong>{form.telephone}</strong> dans un délai de <strong>24 heures</strong> pour valider votre demande.</p>
				</div>
			</div>

			<div class="mt-6 flex flex-col sm:flex-row justify-between gap-3">
				<button on:click={prevStep} class="btn-ghost">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
					</svg>
					Modifier
				</button>
				<button on:click={submitDemande} class="btn-accent" disabled={submitting}>
					{#if submitting}
						<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
						</svg>
						Envoi en cours...
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
						</svg>
						Envoyer ma demande
					{/if}
				</button>
			</div>
		</div>
	{/if}

{/if}
</main>
