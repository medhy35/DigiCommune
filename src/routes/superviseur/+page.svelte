<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import { TYPE_ACTE_LABELS, TYPE_ACTE_ICONS, CONCERNANT_LABELS, MODE_RECEPTION_LABELS, formatDate, formatDateTime, timeAgo, isEscaladee } from '$lib/utils/helpers.js';

	let allDemandes = [];
	let utilisateurs = null;
	let loading = true;
	let activeTab = 'toutes';
	let selectedDemande = null;
	let saving = false;

	// Réassignation
	let showReassignModal = false;
	let reassignAgentId = '';

	// Escalade maire modal
	let showEscaladeMaireModal = false;
	let escaladeMaireMotif = '';

	onMount(async () => {
		const tab = new URL(window.location.href).searchParams.get('tab');
		if (tab === 'escalades') activeTab = 'escalades';

		await loadData();
	});

	async function loadData() {
		loading = true;
		const [dRes, uRes] = await Promise.all([
			fetch('/api/demandes'),
			fetch('/api/utilisateurs')
		]);
		allDemandes = await dRes.json();
		utilisateurs = await uRes.json();

		allDemandes.sort((a, b) => {
			if (isEscaladee(a) && !isEscaladee(b)) return -1;
			if (!isEscaladee(a) && isEscaladee(b)) return 1;
			return new Date(b.created_at) - new Date(a.created_at);
		});

		if (selectedDemande) {
			selectedDemande = allDemandes.find(d => d.id === selectedDemande.id) || null;
		}
		loading = false;
	}

	$: escalades = allDemandes.filter(d => isEscaladee(d) && d.escalade.level === 'superviseur');
	$: stats = {
		total: allDemandes.length,
		recues: allDemandes.filter(d => d.statut === 'recue').length,
		en_cours: allDemandes.filter(d => d.statut === 'en_cours').length,
		traitees: allDemandes.filter(d => ['traitee', 'disponible'].includes(d.statut)).length,
		escalades: escalades.length
	};

	$: displayList = activeTab === 'escalades' ? escalades : allDemandes;

	function agentName(agentId) {
		const agent = utilisateurs?.agents?.find(a => a.id === agentId);
		return agent ? `${agent.prenom} ${agent.nom}` : agentId;
	}

	async function resoudreEscalade() {
		saving = true;
		const res = await fetch(`/api/demandes/${selectedDemande.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ escalade: null, par: 'sup_001' })
		});
		if (res.ok) {
			await loadData();
		}
		saving = false;
	}

	async function escaladerMaire() {
		if (!escaladeMaireMotif.trim()) return;
		saving = true;
		const res = await fetch(`/api/demandes/${selectedDemande.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				escalade: {
					level: 'maire',
					motif: escaladeMaireMotif,
					date: new Date().toISOString(),
					resolu: false,
					par: 'sup_001'
				},
				par: 'sup_001'
			})
		});
		if (res.ok) {
			await loadData();
			showEscaladeMaireModal = false;
			escaladeMaireMotif = '';
		}
		saving = false;
	}

	async function reassigner() {
		if (!reassignAgentId) return;
		saving = true;
		const res = await fetch(`/api/demandes/${selectedDemande.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ agent_id: reassignAgentId, par: 'sup_001' })
		});
		if (res.ok) {
			await loadData();
			showReassignModal = false;
			reassignAgentId = '';
		}
		saving = false;
	}
</script>

<svelte:head>
	<title>Superviseur – CiviCI</title>
</svelte:head>

<main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
	<!-- Stats -->
	<div class="mb-6">
		<h1 class="font-syne font-bold text-2xl text-gray-800 mb-1">Supervision — Toutes les demandes</h1>
		<p class="text-gray-500 text-sm">Vue d'ensemble de la commune. {stats.escalades > 0 ? `⚠️ ${stats.escalades} escalade(s) en attente.` : ''}</p>
	</div>

	<div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
		{#each [
			{ label: 'Total', value: stats.total, color: 'bg-gray-50 text-gray-700' },
			{ label: 'Reçues', value: stats.recues, color: 'bg-blue-50 text-blue-700' },
			{ label: 'En cours', value: stats.en_cours, color: 'bg-amber-50 text-amber-700' },
			{ label: 'Traitées', value: stats.traitees, color: 'bg-primary-50 text-primary-700' },
			{ label: 'Escaladées', value: stats.escalades, color: 'bg-orange-50 text-orange-700' }
		] as s}
			<div class="card p-3">
				<p class="font-syne font-bold text-2xl text-gray-800">{s.value}</p>
				<p class="text-xs text-gray-500 mt-0.5">{s.label}</p>
			</div>
		{/each}
	</div>

	<!-- Tabs -->
	<div class="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 w-fit">
		<button
			on:click={() => activeTab = 'toutes'}
			class="px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'toutes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			Toutes les demandes
		</button>
		<button
			on:click={() => activeTab = 'escalades'}
			class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 {activeTab === 'escalades' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			Escalades reçues
			{#if stats.escalades > 0}
				<span class="bg-accent-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none">{stats.escalades}</span>
			{/if}
		</button>
	</div>

	<div class="grid lg:grid-cols-2 gap-4">
		<!-- Liste -->
		<div>
			{#if loading}
				<div class="flex items-center justify-center py-16 text-gray-400">
					<svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
					</svg>
				</div>
			{:else if displayList.length === 0}
				<div class="card text-center py-12 text-gray-400">
					<p class="text-4xl mb-2">✅</p>
					<p>Aucune escalade en attente</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each displayList as demande}
						<button
							on:click={() => selectedDemande = demande}
							class="w-full card p-4 text-left transition-all border-2
								{selectedDemande?.id === demande.id ? 'border-primary-400 bg-primary-50/50' : 'border-transparent hover:border-gray-200'}
								{isEscaladee(demande) ? 'bg-orange-50/50' : ''}"
						>
							<div class="flex items-center justify-between gap-2">
								<div class="flex items-center gap-2 min-w-0">
									<span class="text-xl">{TYPE_ACTE_ICONS[demande.type_acte]}</span>
									<div class="min-w-0">
										<div class="flex items-center gap-1.5 flex-wrap">
											<span class="font-mono text-sm font-semibold text-gray-800">{demande.id}</span>
											<StatusBadge {demande} />
										</div>
										<p class="text-xs text-gray-500 truncate mt-0.5">
											{demande.demandeur.prenom} {demande.demandeur.nom}
											· {agentName(demande.agent_id)}
										</p>
									</div>
								</div>
								<span class="text-xs text-gray-400 flex-shrink-0">{timeAgo(demande.created_at)}</span>
							</div>
							{#if isEscaladee(demande)}
								<div class="mt-2 text-xs text-orange-700 bg-orange-100 rounded-lg px-2.5 py-1 truncate">
									⚠️ {demande.escalade.motif}
								</div>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Detail panel -->
		<div>
			{#if selectedDemande}
				<div class="space-y-4">
					<!-- Header -->
					<div class="card">
						<div class="flex items-start justify-between mb-3">
							<div>
								<span class="font-mono font-bold text-lg text-gray-800">{selectedDemande.id}</span>
								<div class="flex gap-2 mt-1 flex-wrap">
									<StatusBadge demande={selectedDemande} />
								</div>
							</div>
							<span class="text-3xl">{TYPE_ACTE_ICONS[selectedDemande.type_acte]}</span>
						</div>

						<dl class="grid grid-cols-2 gap-2 text-sm">
							<div><dt class="text-xs text-gray-400">Demandeur</dt><dd class="font-medium mt-0.5">{selectedDemande.demandeur.prenom} {selectedDemande.demandeur.nom}</dd></div>
							<div><dt class="text-xs text-gray-400">Téléphone</dt><dd class="font-medium mt-0.5 text-primary-600">{selectedDemande.demandeur.telephone}</dd></div>
							<div><dt class="text-xs text-gray-400">Type d'acte</dt><dd class="font-medium mt-0.5">{TYPE_ACTE_LABELS[selectedDemande.type_acte]}</dd></div>
							<div><dt class="text-xs text-gray-400">Agent assigné</dt><dd class="font-medium mt-0.5">{agentName(selectedDemande.agent_id)}</dd></div>
						</dl>
					</div>

					<!-- Escalade detail -->
					{#if isEscaladee(selectedDemande) && selectedDemande.escalade.level === 'superviseur'}
						<div class="bg-orange-50 border border-orange-200 rounded-xl p-4">
							<h3 class="font-semibold text-orange-800 mb-2">⚠️ Escalade à traiter</h3>
							<p class="text-sm text-orange-700 mb-1">{selectedDemande.escalade.motif}</p>
							<p class="text-xs text-orange-500">{formatDateTime(selectedDemande.escalade.date)}</p>

							<div class="mt-4 flex gap-2">
								<button
									on:click={resoudreEscalade}
									class="btn-primary text-sm py-2 flex-1 justify-center"
									disabled={saving}
								>
									✅ Résoudre
								</button>
								<button
									on:click={() => showEscaladeMaireModal = true}
									class="flex-1 border-2 border-accent-400 text-accent-700 hover:bg-accent-50 font-semibold text-sm px-3 py-2 rounded-lg transition-all"
								>
									🏛️ → Maire
								</button>
							</div>
						</div>
					{/if}

					<!-- Réassigner -->
					<div class="card">
						<h3 class="font-syne font-semibold text-gray-700 mb-2 text-sm">Réassigner l'agent</h3>
						<div class="flex gap-2">
							<select bind:value={reassignAgentId} class="input-field text-sm flex-1">
								<option value="">— Choisir un agent —</option>
								{#if utilisateurs}
									{#each utilisateurs.agents as agent}
										<option value={agent.id} disabled={agent.id === selectedDemande.agent_id}>
											{agent.prenom} {agent.nom} {agent.id === selectedDemande.agent_id ? '(actuel)' : ''}
										</option>
									{/each}
								{/if}
							</select>
							<button on:click={reassigner} class="btn-secondary text-sm py-2.5" disabled={!reassignAgentId || saving}>
								Réassigner
							</button>
						</div>
					</div>

					<!-- Timeline -->
					<div class="card">
						<h3 class="font-syne font-semibold text-gray-700 mb-3 text-sm">Historique</h3>
						<Timeline historique={selectedDemande.historique} statut={selectedDemande.statut} />
					</div>
				</div>
			{:else}
				<div class="card text-center py-16 text-gray-400">
					<p class="text-4xl mb-3">👈</p>
					<p class="text-sm">Sélectionnez une demande pour voir les détails</p>
				</div>
			{/if}
		</div>
	</div>
</main>

<!-- Modal escalade maire -->
{#if showEscaladeMaireModal}
	<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={() => showEscaladeMaireModal = false}>
		<div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
			<h3 class="font-syne font-bold text-lg text-gray-800 mb-1">Escalader au Maire</h3>
			<p class="text-sm text-gray-500 mb-4">Cette demande sera soumise à la décision du Maire.</p>
			<div>
				<label class="label" for="maire_motif">Motif <span class="text-red-500">*</span></label>
				<textarea
					id="maire_motif"
					bind:value={escaladeMaireMotif}
					rows="3"
					class="input-field resize-none"
					placeholder="Pourquoi cette demande nécessite-t-elle l'intervention du Maire ?"
				></textarea>
			</div>
			<div class="flex gap-3 justify-end mt-4">
				<button on:click={() => showEscaladeMaireModal = false} class="btn-ghost">Annuler</button>
				<button on:click={escaladerMaire} class="btn-accent" disabled={saving || !escaladeMaireMotif.trim()}>
					Escalader au Maire
				</button>
			</div>
		</div>
	</div>
{/if}
