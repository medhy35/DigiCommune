<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Timeline from '$lib/components/Timeline.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { TYPE_ACTE_LABELS, TYPE_ACTE_ICONS, CONCERNANT_LABELS, MODE_RECEPTION_LABELS, formatDateTime, RDV_STATUT_LABELS, RDV_STATUT_COLORS } from '$lib/utils/helpers.js';
	import { downloadAttestationDepotPDF, downloadRecuPaiementPDF, downloadSuiviCompletPDF } from '$lib/utils/pdf.js';

	let numero = '';
	let nom = '';
	let searching = false;
	let searchError = '';

	let demande = null;
	let commune = null;
	let genAttestationLoading = false;
	let genRecuLoading = false;
	let genSuiviLoading = false;

	// Compléments — upload en ligne
	let uploadedComplements = {};   // { index: { name, size, type, data } }
	let complementUploading = false;
	let complementDone = false;

	function handleComplementFile(index, event) {
		const file = event.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (e) => {
			uploadedComplements[index] = { name: file.name, size: file.size, type: file.type, data: e.target.result };
			uploadedComplements = { ...uploadedComplements };
		};
		reader.readAsDataURL(file);
	}

	async function envoyerComplements() {
		if (Object.keys(uploadedComplements).length === 0) return;
		complementUploading = true;
		const docs = Object.entries(uploadedComplements).map(([idx, f]) => ({
			label: demande.complement_demande.items?.[idx] || `Document ${+idx + 1}`,
			nom: f.name, taille: f.size, mimetype: f.type, data: f.data
		}));
		const res = await fetch(`/api/demandes/${demande.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ complement_fourni: { documents: docs } })
		});
		if (res.ok) {
			demande = await res.json();
			complementDone = true;
			uploadedComplements = {};
		}
		complementUploading = false;
	}

	// Rendez-vous
	let rdvModuleActif = false;
	let rdvCfg         = null;
	let rdvExistant    = null;
	let rdvLoading     = false;
	let rdvDate        = '';
	let rdvMinDate     = '';
	let rdvMaxDate     = '';
	let rdvCreneaux    = [];
	let rdvHeure       = '';
	let rdvBooking     = false;
	let rdvError       = '';

	onMount(async () => {
		// Vient de la confirmation de demande (state passé sans paramètre URL)
		const fromState = $page.state?.demande;
		if (fromState) {
			demande = fromState;
			numero = fromState.id;
		}
		const [cRes, sRes] = await Promise.all([fetch('/api/commune'), fetch('/api/settings?role=global')]);
		if (cRes.ok) commune = await cRes.json();
		if (sRes.ok) {
			const sd = await sRes.json();
			rdvModuleActif = sd.settings?.global?.modules?.rdv === true;
			rdvCfg = sd.settings?.rdv || null;
			const delay = rdvCfg?.delai_min_jours ?? 1;
			const maxD  = rdvCfg?.delai_max_jours ?? 30;
			const d1 = new Date(); d1.setDate(d1.getDate() + delay);
			const d2 = new Date(); d2.setDate(d2.getDate() + maxD);
			rdvMinDate = d1.toISOString().slice(0,10);
			rdvMaxDate = d2.toISOString().slice(0,10);
		}
		if (fromState && rdvModuleActif) await loadRdvForDemande(fromState);
	});

	async function handleSearch() {
		if (!numero.trim() || !nom.trim()) return;
		searching = true;
		searchError = '';
		demande = null;

		const res = await fetch(`/api/demandes/${numero.trim().toUpperCase()}`);
		if (res.ok) {
			const d = await res.json();
			if (d.demandeur.nom.toLowerCase() === nom.trim().toLowerCase()) {
				demande = d;
				if (rdvModuleActif) await loadRdvForDemande(d);
			} else {
				searchError = 'Aucune demande trouvée avec ces informations. Vérifiez votre numéro et votre nom de famille.';
			}
		} else {
			searchError = 'Aucune demande trouvée avec ces informations. Vérifiez votre numéro et votre nom de famille.';
		}
		searching = false;
	}

	function resetSearch() {
		demande = null;
		numero = '';
		nom = '';
		searchError = '';
	}

	async function loadRdvForDemande(d) {
		if (!d || d.mode_reception !== 'retrait' || d.statut !== 'disponible') return;
		rdvLoading = true;
		const res = await fetch(`/api/rdv?demande_id=${d.id}`);
		if (res.ok) {
			const list = await res.json();
			rdvExistant = list.find(r => r.statut !== 'annule') || null;
		}
		rdvLoading = false;
	}

	async function loadCreneaux() {
		if (!rdvDate) return;
		rdvHeure = '';
		rdvCreneaux = [];
		const res = await fetch(`/api/rdv?creneaux=${rdvDate}`);
		if (res.ok) rdvCreneaux = await res.json();
	}

	async function prendreRdv() {
		if (!rdvDate || !rdvHeure) return;
		rdvBooking = true;
		rdvError   = '';
		const res = await fetch('/api/rdv', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				demande_id: demande.id,
				demandeur:  { nom: demande.demandeur.nom, prenom: demande.demandeur.prenom, telephone: demande.demandeur.telephone },
				date_rdv:   rdvDate,
				heure_rdv:  rdvHeure
			})
		});
		if (res.ok) {
			rdvExistant = await res.json();
		} else {
			const err = await res.json();
			rdvError = err.error || 'Erreur lors de la prise de rendez-vous.';
		}
		rdvBooking = false;
	}

	async function annulerRdv() {
		if (!rdvExistant) return;
		await fetch(`/api/rdv/${rdvExistant.id}?acteur=citoyen`, { method: 'DELETE' });
		rdvExistant = null;
		rdvDate = ''; rdvHeure = ''; rdvCreneaux = [];
	}

	async function genAttestation() {
		if (!demande || !commune) return;
		genAttestationLoading = true;
		try { await downloadAttestationDepotPDF(demande, commune); } catch(e) {}
		genAttestationLoading = false;
	}

	async function genRecu() {
		if (!demande || !commune) return;
		genRecuLoading = true;
		try { await downloadRecuPaiementPDF(demande, commune); } catch(e) {}
		genRecuLoading = false;
	}

	async function genSuivi() {
		if (!demande || !commune) return;
		genSuiviLoading = true;
		try { await downloadSuiviCompletPDF(demande, commune); } catch(e) {}
		genSuiviLoading = false;
	}
</script>

<svelte:head>
	<title>Suivre ma demande – CiviCI</title>
</svelte:head>

<header class="bg-white border-b border-gray-100 shadow-sm">
	<div class="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
		{#if demande}
			<button on:click={resetSearch} class="text-gray-400 hover:text-gray-600">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
				</svg>
			</button>
		{:else}
			<a href="/" class="text-gray-400 hover:text-gray-600">
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
				</svg>
			</a>
		{/if}
		<div class="flex items-center gap-2">
			<div class="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
				<span class="text-white font-syne font-bold text-xs">C</span>
			</div>
			<span class="font-syne font-semibold text-primary-600">CiviCI</span>
		</div>
		<span class="text-gray-300">|</span>
		<span class="text-gray-600 text-sm">Suivi de demande</span>
	</div>
</header>

<main class="max-w-2xl mx-auto px-4 py-8">

{#if !demande}
	<!-- ── FORMULAIRE DE RECHERCHE ── -->
	<div class="text-center mb-8">
		<div class="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">📬</div>
		<h1 class="font-syne font-bold text-2xl text-gray-800 mb-2">Suivre ma demande</h1>
		<p class="text-gray-500">Saisissez votre numéro de dossier et votre nom de famille pour accéder à votre suivi.</p>
	</div>

	<div class="card">
		<form on:submit|preventDefault={handleSearch} class="space-y-4">
			<div>
				<label class="label" for="numero">Numéro de dossier</label>
				<input
					id="numero"
					type="text"
					bind:value={numero}
					placeholder="CI-XXXXXXXXXX"
					class="input-field text-center font-mono text-lg uppercase {searchError ? 'border-red-400' : ''}"
					maxlength="13"
					autocomplete="off"
				/>
			</div>
			<div>
				<label class="label" for="nom">Nom de famille du demandeur</label>
				<input
					id="nom"
					type="text"
					bind:value={nom}
					placeholder="Votre nom de famille"
					class="input-field {searchError ? 'border-red-400' : ''}"
					autocomplete="family-name"
				/>
			</div>
			{#if searchError}
				<div class="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
					<svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
					</svg>
					{searchError}
				</div>
			{/if}
			<button type="submit" class="btn-primary w-full justify-center py-3" disabled={searching || !numero.trim() || !nom.trim()}>
				{#if searching}
					<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
					</svg>
					Vérification en cours...
				{:else}
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
					Accéder à mon dossier
				{/if}
			</button>
		</form>
	</div>

	<div class="mt-6 text-center space-y-2">
		<p class="text-sm text-gray-400">Vous retrouvez votre numéro de dossier dans l'attestation de dépôt ou le SMS de confirmation.</p>
		<p class="text-sm text-gray-400">
			Vous n'avez pas encore fait de demande ?
			<a href="/demande" class="text-primary-600 hover:underline font-medium">Faire une demande</a>
		</p>
	</div>

{:else}
	<!-- ── DÉTAIL DE LA DEMANDE (inline, pas de navigation) ── -->

	<!-- En-tête dossier -->
	<div class="card mb-4">
		<div class="flex items-start justify-between gap-4">
			<div>
				<p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Votre dossier</p>
				<p class="text-sm text-gray-500 mt-1">Soumis le {formatDateTime(demande.created_at)}</p>
			</div>
			<div class="text-right">
				<StatusBadge {demande} />
				<p class="text-3xl mt-2">{TYPE_ACTE_ICONS[demande.type_acte] || '📄'}</p>
			</div>
		</div>
	</div>

	<!-- Détails -->
	<div class="card mb-4">
		<h2 class="font-syne font-semibold text-gray-700 mb-3">Détails de la demande</h2>
		<dl class="space-y-2 text-sm">
			<div class="flex justify-between py-1.5 border-b border-gray-50">
				<dt class="text-gray-500">Service</dt>
				<dd class="font-medium text-gray-800">{TYPE_ACTE_LABELS[demande.type_acte] || demande.type_acte}</dd>
			</div>
			{#if demande.concernant}
			<div class="flex justify-between py-1.5 border-b border-gray-50">
				<dt class="text-gray-500">Concernant</dt>
				<dd class="font-medium text-gray-800">{CONCERNANT_LABELS[demande.concernant] || demande.concernant}</dd>
			</div>
			{/if}
			{#if demande.personne_concernee?.nom}
			<div class="flex justify-between py-1.5 border-b border-gray-50">
				<dt class="text-gray-500">Personne concernée</dt>
				<dd class="font-medium text-gray-800">{demande.personne_concernee.prenom} {demande.personne_concernee.nom}</dd>
			</div>
			{/if}
			{#if demande.copies > 1}
			<div class="flex justify-between py-1.5 border-b border-gray-50">
				<dt class="text-gray-500">Copies</dt>
				<dd class="font-medium text-gray-800">{demande.copies}</dd>
			</div>
			{/if}
			<div class="flex justify-between py-1.5">
				<dt class="text-gray-500">Mode de réception</dt>
				<dd class="font-medium text-gray-800">{MODE_RECEPTION_LABELS[demande.mode_reception]}</dd>
			</div>
		</dl>
	</div>

	<!-- Timeline -->
	<div class="card mb-4">
		<h2 class="font-syne font-semibold text-gray-700 mb-4">Avancement de votre dossier</h2>
		<Timeline historique={demande.historique} statut={demande.statut} />
	</div>

	<!-- Compléments requis / fournis -->
	{#if demande.complement_demande}
		{#if demande.statut === 'complements_requis'}
			<div class="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
				<div class="flex items-start gap-3">
					<span class="text-2xl flex-shrink-0">📋</span>
					<div class="flex-1">
						<p class="font-semibold text-purple-800 mb-1">Des compléments vous sont demandés</p>
						<p class="text-sm text-purple-700 mb-3">La mairie a besoin de documents supplémentaires pour traiter votre dossier.</p>
						{#if demande.complement_demande.items?.length}
							<div class="mb-3">
								<p class="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Documents à fournir :</p>
								<ul class="space-y-3">
									{#each demande.complement_demande.items as item, i}
										<li class="flex flex-col gap-1">
											<div class="flex items-center gap-2 text-sm text-purple-800">
												<svg class="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
												</svg>
												{item}
											</div>
											{#if uploadedComplements[i]}
												<div class="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-xs text-green-700 ml-6">
													<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
													{uploadedComplements[i].name}
													<button on:click={() => { const u = {...uploadedComplements}; delete u[i]; uploadedComplements = u; }} class="ml-auto text-red-400 hover:text-red-600">✕</button>
												</div>
											{:else}
												<label class="ml-6 cursor-pointer inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-400 bg-white rounded-lg px-3 py-1.5 transition-all w-fit">
													<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
													Joindre le fichier
													<input type="file" class="hidden" accept=".jpg,.jpeg,.png,.pdf" on:change={(e) => handleComplementFile(i, e)} />
												</label>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/if}
						{#if demande.complement_demande.motif}
							<div class="bg-purple-100 rounded-lg p-3 text-sm text-purple-800 mb-3">
								<p class="font-medium mb-0.5">Message de la mairie :</p>
								<p>{demande.complement_demande.motif}</p>
							</div>
						{/if}
						{#if Object.keys(uploadedComplements).length > 0}
							<button
								on:click={envoyerComplements}
								disabled={complementUploading}
								class="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-all"
							>
								{#if complementUploading}
									<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
									Envoi en cours…
								{:else}
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
									Envoyer {Object.keys(uploadedComplements).length} document{Object.keys(uploadedComplements).length > 1 ? 's' : ''} à la mairie
								{/if}
							</button>
						{:else}
							<p class="text-xs text-purple-600 mt-1">
								📍 Joignez vos documents ci-dessus ou présentez-vous à la mairie.
							</p>
						{/if}
					</div>
				</div>
			</div>
		{:else if demande.statut === 'complements_fournis'}
			<div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex items-start gap-3">
				<span class="text-2xl flex-shrink-0">✅</span>
				<div>
					<p class="font-semibold text-indigo-800">Documents envoyés avec succès</p>
					<p class="text-sm text-indigo-700 mt-1">La mairie a bien reçu vos documents complémentaires. Votre dossier est en cours de traitement.</p>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Messages disponibilité -->
	{#if demande.statut === 'disponible' && demande.mode_reception === 'retrait'}
		{#if rdvModuleActif}
			<!-- ── Module RDV actif ── -->
			{#if rdvLoading}
				<div class="bg-gray-50 rounded-xl p-4 flex items-center gap-3 mb-4 text-sm text-gray-400 animate-pulse">
					<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
					Vérification des rendez-vous…
				</div>
			{:else if rdvExistant}
				<!-- RDV existant -->
				<div class="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
					<div class="flex items-start gap-3">
						<span class="text-2xl">📅</span>
						<div class="flex-1">
							<p class="font-semibold text-green-800">Rendez-vous confirmé !</p>
							<p class="text-sm text-green-700 mt-1">
								Le {new Date(rdvExistant.date_rdv + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })}
								à {rdvExistant.heure_rdv}
								— {rdvExistant.lieu || 'Mairie'}
							</p>
							<span class="inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium {RDV_STATUT_COLORS[rdvExistant.statut]}">
								{RDV_STATUT_LABELS[rdvExistant.statut] || rdvExistant.statut}
							</span>
						</div>
					</div>
					{#if rdvExistant.statut !== 'effectue' && rdvExistant.statut !== 'annule'}
						<button on:click={annulerRdv} class="mt-3 text-xs text-red-500 hover:text-red-700 underline">Annuler ce rendez-vous</button>
					{/if}
				</div>
			{:else}
				<!-- Formulaire de prise de RDV -->
				<div class="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-4">
					<div class="flex items-start gap-3 mb-4">
						<span class="text-2xl">🏛️</span>
						<div>
							<p class="font-semibold text-primary-800">Votre acte est prêt !</p>
							<p class="text-sm text-primary-700 mt-1">Prenez rendez-vous pour venir le retirer à la mairie.</p>
						</div>
					</div>

					<!-- Choix de la date -->
					<div class="space-y-3">
						<div>
							<label class="text-xs font-semibold text-primary-700 block mb-1">Choisir une date</label>
							<input type="date" bind:value={rdvDate} min={rdvMinDate} max={rdvMaxDate}
								on:change={loadCreneaux}
								class="input-field text-sm bg-white" />
						</div>

						<!-- Créneaux horaires -->
						{#if rdvDate && rdvCreneaux.length === 0}
							<p class="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">La mairie est fermée ce jour-là. Veuillez choisir un autre jour.</p>
						{:else if rdvCreneaux.length > 0}
							<div>
								<label class="text-xs font-semibold text-primary-700 block mb-2">Choisir un créneau</label>
								<div class="flex flex-wrap gap-2">
									{#each rdvCreneaux as slot}
										<button
											on:click={() => slot.disponible && (rdvHeure = slot.heure)}
											disabled={!slot.disponible}
											class="px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all
												{rdvHeure === slot.heure
													? 'border-primary-500 bg-primary-500 text-white'
													: slot.disponible
														? 'border-primary-300 text-primary-700 hover:bg-primary-100'
														: 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'}"
										>
											{slot.heure}
											{#if !slot.disponible}<span class="text-xs ml-1">Complet</span>{/if}
										</button>
									{/each}
								</div>
							</div>
						{/if}

						{#if rdvError}
							<p class="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{rdvError}</p>
						{/if}

						{#if rdvDate && rdvHeure}
							<button on:click={prendreRdv} disabled={rdvBooking}
								class="btn-primary w-full justify-center py-2.5 text-sm mt-1">
								{#if rdvBooking}
									<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
									Réservation en cours…
								{:else}
									📅 Confirmer le rendez-vous du {new Date(rdvDate + 'T12:00:00').toLocaleDateString('fr-FR', { day:'numeric', month:'long' })} à {rdvHeure}
								{/if}
							</button>
						{/if}
					</div>
				</div>
			{/if}
		{:else}
			<!-- Module RDV désactivé : message classique -->
			<div class="bg-primary-50 border border-primary-200 rounded-xl p-4 flex gap-3 mb-4">
				<span class="text-2xl">🏛️</span>
				<div>
					<p class="font-semibold text-primary-800">Votre acte est prêt !</p>
					<p class="text-sm text-primary-700 mt-1">Venez le retirer à la mairie muni de votre pièce d'identité.</p>
				</div>
			</div>
		{/if}
	{/if}
	{#if demande.statut === 'disponible' && demande.mode_reception === 'whatsapp'}
		<div class="bg-primary-50 border border-primary-200 rounded-xl p-4 flex gap-3 mb-4">
			<span class="text-2xl">📱</span>
			<div>
				<p class="font-semibold text-primary-800">Votre acte a été envoyé !</p>
				<p class="text-sm text-primary-700 mt-1">Le PDF a été envoyé sur votre WhatsApp au {demande.demandeur.telephone}.</p>
			</div>
		</div>
	{/if}

	<!-- Documents téléchargeables -->
	<div class="card mt-4 space-y-3">
		<h2 class="font-syne font-semibold text-gray-700 text-sm">Mes documents</h2>

		<!-- Récapitulatif complet (nouveau) -->
		<button on:click={genSuivi} disabled={genSuiviLoading}
			class="w-full flex items-center gap-2 justify-center text-sm font-medium px-4 py-2.5 rounded-lg border-2 border-primary-400 text-primary-700 hover:bg-primary-50 transition-all">
			{#if genSuiviLoading}
				<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
			{:else}
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
			{/if}
			Récapitulatif complet (statut + documents à apporter)
		</button>

		<button on:click={genAttestation} disabled={genAttestationLoading}
			class="w-full flex items-center gap-2 justify-center text-sm font-medium px-4 py-2.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-all">
			{#if genAttestationLoading}
				<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
			{:else}
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
			{/if}
			Attestation de dépôt
		</button>
		{#if demande.paiement?.statut === 'paye'}
			<button on:click={genRecu} disabled={genRecuLoading}
				class="w-full flex items-center gap-2 justify-center text-sm font-medium px-4 py-2.5 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 transition-all">
				{#if genRecuLoading}
					<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
				{:else}
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
				{/if}
				Reçu de paiement — {demande.paiement.montant?.toLocaleString('fr-FR')} FCFA
			</button>
		{/if}
	</div>

	<div class="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
		<button on:click={resetSearch} class="btn-secondary text-sm">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
			</svg>
			Chercher un autre dossier
		</button>
		<a href="/" class="btn-ghost text-sm">← Retour à l'accueil</a>
	</div>
{/if}

</main>
