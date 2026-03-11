<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import DemandeDetailPanel from '$lib/components/DemandeDetailPanel.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatDateTime, isEscaladee } from '$lib/utils/helpers.js';
	import { downloadActePDF, downloadAttestationDepotPDF, downloadRecuPaiementPDF } from '$lib/utils/pdf.js';
	import { toast } from '$lib/stores/toast.js';

	let demande = null;
	let commune = null;
	let loading = true;
	let saving = false;
	let generatingPdf = false;
	let sendingWhatsapp = false;

	// Escalade modal
	let showEscaladeModal = false;
	let escaladeMotif = '';
	let escaladeError = '';

	// Rejet modal
	let showRejetModal = false;
	let rejetMotif = '';
	let rejetError = '';

	// Note interne
	let noteTexte = '';
	let savingNote = false;

	// Documents PDF
	let generatingAttestation = false;
	let generatingRecu = false;

	// Envoi WhatsApp simulation
	let whatsappSent = false;

	$: id = $page.params.id;

	onMount(async () => {
		const [dRes, cRes] = await Promise.all([
			fetch(`/api/demandes/${id}`),
			fetch('/api/commune')
		]);
		if (dRes.ok) demande = await dRes.json();
		else goto('/agent');
		commune = await cRes.json();
		loading = false;
	});

	async function updateStatut(newStatut, note = '') {
		saving = true;
		const res = await fetch(`/api/demandes/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ statut: newStatut, note, par: 'agent_001' })
		});
		if (res.ok) {
			demande = await res.json();
			const labels = { en_cours: 'Dossier pris en charge', traitee: 'Dossier marqué traité', disponible: 'Dossier disponible' };
			toast(labels[newStatut] || 'Statut mis à jour');
		}
		saving = false;
	}

	async function validerPaiement() {
		saving = true;
		const res = await fetch(`/api/demandes/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ paiement_valide: true, par: 'agent_001' })
		});
		if (res.ok) { demande = await res.json(); toast('Paiement encaissé confirmé'); }
		saving = false;
	}

	async function rejeter() {
		if (!rejetMotif.trim()) { rejetError = 'Le motif est obligatoire.'; return; }
		saving = true;
		const res = await fetch(`/api/demandes/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ statut: 'rejetee', note: rejetMotif, par: 'agent_001' })
		});
		if (res.ok) {
			demande = await res.json();
			showRejetModal = false;
			rejetMotif = '';
			toast('Demande rejetée', 'warning');
		}
		saving = false;
	}

	async function ajouterNote() {
		if (!noteTexte.trim()) return;
		savingNote = true;
		const res = await fetch(`/api/demandes/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ note_interne: noteTexte, par: 'agent_001' })
		});
		if (res.ok) {
			demande = await res.json();
			noteTexte = '';
			toast('Note ajoutée à l\'historique', 'info');
		}
		savingNote = false;
	}

	async function escalader() {
		if (!escaladeMotif.trim()) {
			escaladeError = 'Le motif est obligatoire.';
			return;
		}
		saving = true;
		const res = await fetch(`/api/demandes/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				escalade: {
					level: 'superviseur',
					motif: escaladeMotif,
					date: new Date().toISOString(),
					resolu: false,
					par: 'agent_001'
				},
				par: 'agent_001'
			})
		});
		if (res.ok) {
			demande = await res.json();
			showEscaladeModal = false;
			escaladeMotif = '';
			toast('Escalade envoyée au superviseur', 'warning');
		}
		saving = false;
	}

	async function generatePDF() {
		if (!demande || !commune) return;
		generatingPdf = true;
		try {
			await downloadActePDF(demande, commune);
			toast('Acte officiel généré avec succès');
		} catch (e) {
			console.error('PDF error:', e);
			toast('Erreur lors de la génération du PDF', 'error');
		}
		generatingPdf = false;
	}

	async function genAttestation() {
		if (!demande || !commune) return;
		generatingAttestation = true;
		try {
			await downloadAttestationDepotPDF(demande, commune);
			toast('Attestation de dépôt générée');
		} catch (e) {
			toast('Erreur génération attestation', 'error');
		}
		generatingAttestation = false;
	}

	async function genRecu() {
		if (!demande || !commune) return;
		generatingRecu = true;
		try {
			await downloadRecuPaiementPDF(demande, commune);
			toast('Reçu de paiement généré');
		} catch (e) {
			toast('Erreur génération reçu', 'error');
		}
		generatingRecu = false;
	}

	function simulateWhatsapp() {
		sendingWhatsapp = true;
		setTimeout(() => {
			sendingWhatsapp = false;
			whatsappSent = true;
			toast('Acte envoyé par WhatsApp');
		}, 1500);
	}

	const NEXT_STATUT = {
		recue: 'en_cours',
		en_cours: 'traitee',
		traitee: 'disponible'
	};

	const NEXT_LABEL = {
		recue: 'Prendre en charge',
		en_cours: 'Marquer comme traitée',
		traitee: 'Disponible'
	};
</script>

<svelte:head>
	<title>{id} – Fiche demande – CiviCI</title>
</svelte:head>

{#if loading}
	<div class="flex items-center justify-center min-h-screen text-gray-400">
		<svg class="w-10 h-10 animate-spin" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
		</svg>
	</div>
{:else if demande}
<main class="max-w-4xl mx-auto px-4 sm:px-6 py-6">
	<!-- Header -->
	<div class="flex items-center gap-3 mb-6">
		<button on:click={() => goto('/agent')} class="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
			</svg>
		</button>
		<div class="flex-1">
			<div class="flex items-center gap-3 flex-wrap">
				<h1 class="font-mono font-bold text-xl text-gray-800">{demande.id}</h1>
				<StatusBadge {demande} />
				{#if isEscaladee(demande)}
					<span class="badge-escaladee">⚠️ Escalade → {demande.escalade.level}</span>
				{/if}
			</div>
			<p class="text-sm text-gray-500 mt-0.5">Soumis le {formatDateTime(demande.created_at)}</p>
		</div>
	</div>

	<div class="grid lg:grid-cols-3 gap-4">
		<!-- LEFT: Détail complet via composant réutilisable (prévisualisation documents incluse) -->
		<div class="lg:col-span-2">
			<DemandeDetailPanel {demande} />
		</div>

		<!-- RIGHT: Actions -->
		<div class="space-y-4">
			<!-- Mise à jour statut -->
			{#if !isEscaladee(demande) && demande.statut !== 'disponible' && demande.statut !== 'rejetee'}
				<div class="card">
					<h3 class="font-syne font-semibold text-gray-700 mb-3">Mettre à jour le statut</h3>
					<button
						on:click={() => updateStatut(NEXT_STATUT[demande.statut], '')}
						class="btn-primary w-full justify-center"
						disabled={saving}
					>
						{#if saving}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
							</svg>
						{:else}
							✅
						{/if}
						{NEXT_LABEL[demande.statut]}
					</button>
				</div>
			{/if}

			<!-- Paiement en mairie -->
			{#if demande.paiement?.statut === 'en_attente' && demande.paiement?.mode === 'mairie'}
				<div class="card border-l-4 border-amber-400">
					<h3 class="font-syne font-semibold text-gray-700 mb-1">Paiement en mairie</h3>
					<p class="text-xs text-gray-500 mb-3">
						{demande.paiement.montant?.toLocaleString('fr-FR')} FCFA à encaisser au guichet.
					</p>
					<button
						on:click={validerPaiement}
						class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm rounded-lg transition-all"
						disabled={saving}
					>
						{#if saving}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
							</svg>
						{:else}
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
							</svg>
						{/if}
						Confirmer encaissement
					</button>
				</div>
			{/if}

			<!-- Documents PDF -->
			<div class="card space-y-3">
				<h3 class="font-syne font-semibold text-gray-700">Documents</h3>

				<!-- Attestation de dépôt — toujours disponible -->
				<button
					on:click={genAttestation}
					class="w-full flex items-center gap-2 justify-center text-sm font-medium px-4 py-2.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-all"
					disabled={generatingAttestation}
				>
					{#if generatingAttestation}
						<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
						</svg>
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
						</svg>
					{/if}
					Attestation de dépôt
				</button>

				<!-- Reçu de paiement — si paiement validé -->
				{#if demande.paiement?.statut === 'paye'}
					<button
						on:click={genRecu}
						class="w-full flex items-center gap-2 justify-center text-sm font-medium px-4 py-2.5 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 transition-all"
						disabled={generatingRecu}
					>
						{#if generatingRecu}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
							</svg>
						{:else}
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
							</svg>
						{/if}
						Reçu de paiement ({demande.paiement.montant?.toLocaleString('fr-FR')} FCFA)
					</button>
				{/if}

				<!-- Acte officiel — si dossier traité/disponible -->
				{#if ['traitee', 'disponible'].includes(demande.statut)}
					<button
						on:click={generatePDF}
						class="btn-secondary w-full justify-center text-sm"
						disabled={generatingPdf}
					>
						{#if generatingPdf}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
							</svg>
							Génération...
						{:else}
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
							</svg>
							Acte officiel (PDF)
						{/if}
					</button>

					{#if demande.mode_reception === 'whatsapp'}
						<button
							on:click={simulateWhatsapp}
							class="w-full justify-center text-sm font-semibold px-4 py-2.5 rounded-lg border-2 transition-all
								{whatsappSent ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-green-300 text-green-700 hover:bg-green-50'}"
							disabled={sendingWhatsapp || whatsappSent}
						>
							{#if sendingWhatsapp}
								<svg class="w-4 h-4 animate-spin inline mr-2" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
								</svg>
								Envoi...
							{:else if whatsappSent}
								✅ Envoyé par WhatsApp
							{:else}
								📱 Envoyer par WhatsApp
							{/if}
						</button>
						{#if whatsappSent}
							<p class="text-xs text-gray-400 text-center">Simulé — PDF envoyé au {demande.demandeur.telephone}</p>
						{/if}
					{/if}
				{/if}
			</div>

			<!-- Note interne -->
			{#if demande.statut !== 'rejetee'}
				<div class="card">
					<h3 class="font-syne font-semibold text-gray-700 mb-2">Note interne</h3>
					<textarea
						bind:value={noteTexte}
						rows="3"
						class="input-field text-sm resize-none w-full"
						placeholder="Ajouter une note sans changer le statut..."
					></textarea>
					<button
						on:click={ajouterNote}
						class="mt-2 w-full px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm rounded-lg transition-all flex items-center justify-center gap-2"
						disabled={savingNote || !noteTexte.trim()}
					>
						{#if savingNote}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
							</svg>
						{/if}
						Ajouter la note
					</button>
				</div>
			{/if}

			<!-- Escalade + Rejeter -->
			{#if !isEscaladee(demande) && demande.statut !== 'rejetee' && demande.statut !== 'disponible'}
				<div class="card">
					<h3 class="font-syne font-semibold text-gray-700 mb-3">Actions avancées</h3>
					<div class="space-y-2">
						<button
							on:click={() => showEscaladeModal = true}
							class="w-full px-4 py-2.5 border-2 border-orange-300 text-orange-700 hover:bg-orange-50 font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
							</svg>
							Escalader au superviseur
						</button>
						<button
							on:click={() => showRejetModal = true}
							class="w-full px-4 py-2.5 border-2 border-red-200 text-red-600 hover:bg-red-50 font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
							</svg>
							Rejeter la demande
						</button>
					</div>
				</div>
			{/if}

			<!-- Lien suivi citoyen -->
			<a href="/suivi/{demande.id}" target="_blank" class="card flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition-colors group">
				<svg class="w-4 h-4 flex-shrink-0 group-hover:text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
				</svg>
				Voir la page de suivi citoyen
			</a>
		</div>
	</div>
</main>

<!-- MODAL ESCALADE -->
{#if showEscaladeModal}
	<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={() => showEscaladeModal = false}>
		<div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
			<div class="flex items-start justify-between mb-4">
				<div>
					<h3 class="font-syne font-bold text-lg text-gray-800">Escalader au superviseur</h3>
					<p class="text-sm text-gray-500 mt-0.5">Dossier {demande.id}</p>
				</div>
				<button on:click={() => showEscaladeModal = false} class="text-gray-400 hover:text-gray-600 p-1">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>
			</div>

			<div class="bg-orange-50 border border-orange-100 rounded-xl p-3 mb-4 text-sm text-orange-700">
				⚠️ Le superviseur sera notifié et pourra prendre en charge ce dossier.
			</div>

			<div>
				<label class="label" for="motif">
					Motif de l'escalade <span class="text-red-500">*</span>
				</label>
				<textarea
					id="motif"
					bind:value={escaladeMotif}
					rows="4"
					class="input-field resize-none {escaladeError ? 'border-red-400' : ''}"
					placeholder="Décrivez le problème rencontré (document introuvable, incohérence, cas particulier...)..."
				></textarea>
				{#if escaladeError}<p class="text-xs text-red-500 mt-1">{escaladeError}</p>{/if}
			</div>

			<div class="mt-4 flex gap-3 justify-end">
				<button on:click={() => showEscaladeModal = false} class="btn-ghost">Annuler</button>
				<button
					on:click={escalader}
					class="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all flex items-center gap-2"
					disabled={saving}
				>
					{#if saving}
						<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
						</svg>
					{/if}
					Escalader
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MODAL REJET -->
{#if showRejetModal}
	<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={() => showRejetModal = false}>
		<div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
			<div class="flex items-start justify-between mb-4">
				<div>
					<h3 class="font-syne font-bold text-lg text-gray-800">Rejeter la demande</h3>
					<p class="text-sm text-gray-500 mt-0.5">Dossier {demande.id}</p>
				</div>
				<button on:click={() => showRejetModal = false} class="text-gray-400 hover:text-gray-600 p-1">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>
			</div>

			<div class="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 text-sm text-red-700">
				❌ Cette action est irréversible. Le citoyen sera informé du rejet.
			</div>

			{#if demande.paiement?.statut === 'paye' && ['mobile_money', 'en_ligne', 'online'].includes(demande.paiement?.mode)}
				<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-800 flex items-start gap-2">
					<span class="text-lg flex-shrink-0">💸</span>
					<div>
						<p class="font-semibold">Paiement mobile money déjà encaissé</p>
						<p class="mt-0.5">Un remboursement de <strong>{demande.paiement.montant?.toLocaleString('fr-FR')} FCFA</strong> sera automatiquement initié et transmis au superviseur pour traitement.</p>
						{#if demande.paiement.reference}
							<p class="mt-1 font-mono text-xs text-amber-600">Réf. transaction : {demande.paiement.reference}</p>
						{/if}
					</div>
				</div>
			{/if}

			<div>
				<label class="label" for="rejet-motif">
					Motif du rejet <span class="text-red-500">*</span>
				</label>
				<textarea
					id="rejet-motif"
					bind:value={rejetMotif}
					rows="4"
					class="input-field resize-none {rejetError ? 'border-red-400' : ''}"
					placeholder="Document manquant, informations incorrectes, demande non conforme..."
				></textarea>
				{#if rejetError}<p class="text-xs text-red-500 mt-1">{rejetError}</p>{/if}
			</div>

			<div class="mt-4 flex gap-3 justify-end">
				<button on:click={() => showRejetModal = false} class="btn-ghost">Annuler</button>
				<button
					on:click={rejeter}
					class="bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all flex items-center gap-2"
					disabled={saving}
				>
					{#if saving}
						<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
						</svg>
					{/if}
					Confirmer le rejet
				</button>
			</div>
		</div>
	</div>
{/if}
{/if}
