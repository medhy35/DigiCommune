<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Timeline from '$lib/components/Timeline.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { TYPE_ACTE_LABELS, TYPE_ACTE_ICONS, CONCERNANT_LABELS, MODE_RECEPTION_LABELS, formatDateTime } from '$lib/utils/helpers.js';
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

	onMount(async () => {
		// Vient de la confirmation de demande (state passé sans paramètre URL)
		const fromState = $page.state?.demande;
		if (fromState) {
			demande = fromState;
			numero = fromState.id;
		}
		const cRes = await fetch('/api/commune');
		if (cRes.ok) commune = await cRes.json();
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

	<!-- Messages disponibilité -->
	{#if demande.statut === 'disponible' && demande.mode_reception === 'retrait'}
		<div class="bg-primary-50 border border-primary-200 rounded-xl p-4 flex gap-3 mb-4">
			<span class="text-2xl">🏛️</span>
			<div>
				<p class="font-semibold text-primary-800">Votre acte est prêt !</p>
				<p class="text-sm text-primary-700 mt-1">Venez le retirer à la mairie muni de votre pièce d'identité.</p>
			</div>
		</div>
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
