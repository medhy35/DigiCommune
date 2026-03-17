<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Timeline from '$lib/components/Timeline.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { TYPE_ACTE_LABELS, TYPE_ACTE_ICONS, CONCERNANT_LABELS, MODE_RECEPTION_LABELS, formatDate, formatDateTime } from '$lib/utils/helpers.js';
	import { downloadAttestationDepotPDF, downloadRecuPaiementPDF } from '$lib/utils/pdf.js';
	import CommuneLogo from '$lib/components/CommuneLogo.svelte';

	let demande = null;
	let commune = null;
	let loading = true;
	let error = null;
	let genAttestationLoading = false;
	let genRecuLoading = false;

	$: numero = $page.params.numero;

	onMount(async () => {
		const [dRes, cRes] = await Promise.all([
			fetch(`/api/demandes/${numero}`),
			fetch('/api/commune')
		]);
		if (dRes.ok) demande = await dRes.json();
		else error = 'Demande introuvable. Vérifiez votre numéro de dossier.';
		if (cRes.ok) commune = await cRes.json();
		loading = false;
	});

	async function genAttestation() {
		if (!demande || !commune) return;
		genAttestationLoading = true;
		try { await downloadAttestationDepotPDF(demande, commune); }
		catch(e) { console.error(e); }
		genAttestationLoading = false;
	}

	async function genRecu() {
		if (!demande || !commune) return;
		genRecuLoading = true;
		try { await downloadRecuPaiementPDF(demande, commune); }
		catch(e) { console.error(e); }
		genRecuLoading = false;
	}
</script>

<svelte:head>
	<title>Suivi {numero} – CiviCI</title>
</svelte:head>

<header class="bg-white border-b border-gray-100 shadow-sm">
	<div class="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
		<a href="/suivi" class="text-gray-400 hover:text-gray-600">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
			</svg>
		</a>
		<div class="flex items-center gap-2">
			<CommuneLogo {commune} size="w-7 h-7" />
			<span class="font-syne font-semibold text-primary-600">{commune?.nom_app || 'CiviCI'}</span>
		</div>
		<span class="text-gray-300">|</span>
		<span class="font-mono text-sm text-gray-600">{numero}</span>
	</div>
</header>

<main class="max-w-2xl mx-auto px-4 py-8">
	{#if loading}
		<div class="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
			<svg class="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
			</svg>
			<p>Chargement...</p>
		</div>
	{:else if error}
		<div class="text-center py-16">
			<div class="text-5xl mb-4">🔍</div>
			<h2 class="font-syne font-bold text-xl text-gray-700 mb-2">Demande introuvable</h2>
			<p class="text-gray-500 mb-6">{error}</p>
			<a href="/suivi" class="btn-primary">Réessayer</a>
		</div>
	{:else if demande}
		<!-- Header demande -->
		<div class="card mb-4">
			<div class="flex items-start justify-between gap-4">
				<div>
					<p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Numéro de dossier</p>
					<h1 class="font-mono font-bold text-2xl text-gray-800">{demande.id}</h1>
					<p class="text-sm text-gray-500 mt-1">Soumis le {formatDateTime(demande.created_at)}</p>
				</div>
				<div class="text-right">
					<StatusBadge {demande} />
					<p class="text-3xl mt-2">{TYPE_ACTE_ICONS[demande.type_acte]}</p>
				</div>
			</div>
		</div>

		<!-- Info demande -->
		<div class="card mb-4">
			<h2 class="font-syne font-semibold text-gray-700 mb-3">Détails de la demande</h2>
			<dl class="space-y-2 text-sm">
				<div class="flex justify-between py-1.5 border-b border-gray-50">
					<dt class="text-gray-500">Type d'acte</dt>
					<dd class="font-medium text-gray-800">{TYPE_ACTE_LABELS[demande.type_acte]}</dd>
				</div>
				<div class="flex justify-between py-1.5 border-b border-gray-50">
					<dt class="text-gray-500">Concernant</dt>
					<dd class="font-medium text-gray-800">{CONCERNANT_LABELS[demande.concernant]}</dd>
				</div>
				<div class="flex justify-between py-1.5 border-b border-gray-50">
					<dt class="text-gray-500">Personne concernée</dt>
					<dd class="font-medium text-gray-800">{demande.personne_concernee.prenom} {demande.personne_concernee.nom}</dd>
				</div>
				<div class="flex justify-between py-1.5 border-b border-gray-50">
					<dt class="text-gray-500">Nombre de copies</dt>
					<dd class="font-medium text-gray-800">{demande.copies}</dd>
				</div>
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

		<!-- Compléments requis -->
		{#if demande.statut === 'complements_requis' && demande.complement_demande}
			<div class="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
				<div class="flex items-start gap-3">
					<span class="text-2xl flex-shrink-0">📋</span>
					<div class="flex-1">
						<p class="font-semibold text-purple-800 mb-1">Des compléments vous sont demandés</p>
						<p class="text-sm text-purple-700 mb-3">
							La mairie a besoin d'informations ou de documents supplémentaires pour traiter votre dossier.
						</p>
						{#if demande.complement_demande.items?.length}
							<div class="mb-3">
								<p class="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Documents à fournir :</p>
								<ul class="space-y-1">
									{#each demande.complement_demande.items as item}
										<li class="flex items-center gap-2 text-sm text-purple-800">
											<svg class="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
											</svg>
											{item}
										</li>
									{/each}
								</ul>
							</div>
						{/if}
						{#if demande.complement_demande.motif}
							<div class="bg-purple-100 rounded-lg p-3 text-sm text-purple-800">
								<p class="font-medium mb-0.5">Message de la mairie :</p>
								<p>{demande.complement_demande.motif}</p>
							</div>
						{/if}
						<p class="text-xs text-purple-600 mt-3">
							📍 Présentez-vous à la mairie avec les documents requis ou contactez-nous au numéro indiqué sur votre attestation de dépôt.
						</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Message mode retrait -->
		{#if demande.statut === 'disponible' && demande.mode_reception === 'retrait'}
			<div class="bg-primary-50 border border-primary-200 rounded-xl p-4 flex gap-3">
				<span class="text-2xl">🏛️</span>
				<div>
					<p class="font-semibold text-primary-800">Votre acte est prêt !</p>
					<p class="text-sm text-primary-700 mt-1">Venez retirer votre acte à la mairie muni de votre CNI ou d'une pièce d'identité valide.</p>
				</div>
			</div>
		{/if}

		{#if demande.statut === 'disponible' && demande.mode_reception === 'whatsapp'}
			<div class="bg-primary-50 border border-primary-200 rounded-xl p-4 flex gap-3">
				<span class="text-2xl">📱</span>
				<div>
					<p class="font-semibold text-primary-800">Votre acte a été envoyé !</p>
					<p class="text-sm text-primary-700 mt-1">Le PDF de votre acte a été envoyé sur votre WhatsApp au {demande.demandeur.telephone}.</p>
				</div>
			</div>
		{/if}

		<!-- Documents téléchargeables -->
		<div class="card mt-4 space-y-3">
			<h2 class="font-syne font-semibold text-gray-700 text-sm">Mes documents</h2>

			<!-- Attestation de dépôt — toujours disponible -->
			<button
				on:click={genAttestation}
				class="w-full flex items-center gap-2 justify-center text-sm font-medium px-4 py-2.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-all"
				disabled={genAttestationLoading}
			>
				{#if genAttestationLoading}
					<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
				{:else}
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
				{/if}
				Attestation de dépôt
			</button>

			<!-- Reçu paiement — si payé -->
			{#if demande.paiement?.statut === 'paye'}
				<button
					on:click={genRecu}
					class="w-full flex items-center gap-2 justify-center text-sm font-medium px-4 py-2.5 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 transition-all"
					disabled={genRecuLoading}
				>
					{#if genRecuLoading}
						<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
					{/if}
					Reçu de paiement — {demande.paiement.montant?.toLocaleString('fr-FR')} FCFA
				</button>
			{/if}
		</div>

		<div class="mt-4 text-center">
			<a href="/" class="text-sm text-gray-400 hover:text-primary-600 transition-colors">← Retour à l'accueil</a>
		</div>
	{/if}
</main>
