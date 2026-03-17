<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import DemandeDetailPanel from '$lib/components/DemandeDetailPanel.svelte';
	import { TYPE_ACTE_LABELS, TYPE_ACTE_ICONS, CONCERNANT_LABELS, MODE_RECEPTION_LABELS, formatDate, formatDateTime, timeAgo, isEscaladee, isSLADepassee } from '$lib/utils/helpers.js';
	import { toast } from '$lib/stores/toast.js';
	import { downloadBonRemboursementPDF } from '$lib/utils/pdf.js';

	let commune = null;
	let genBonRemboursementLoading = false;

	async function genBonRemboursement() {
		if (!selectedDemande) return;
		if (!commune) {
			const cRes = await fetch('/api/commune');
			if (cRes.ok) commune = await cRes.json();
		}
		genBonRemboursementLoading = true;
		try { await downloadBonRemboursementPDF(selectedDemande, commune); }
		catch(e) { console.error(e); toast('Erreur génération PDF', 'error'); }
		genBonRemboursementLoading = false;
	}

	let allDemandes = [];
	let utilisateurs = null;
	let loading = true;
	let activeTab = 'toutes';
	let selectedDemande = null;
	let saving = false;

	// ──────────────────────────────────────────────────────────
	// Filtres & recherche
	// ──────────────────────────────────────────────────────────
	let searchQuery = '';
	let filterStatut = '';
	let filterTypeActe = '';
	let filterAgent = '';

	$: activeFiltersCount =
		(searchQuery.trim() ? 1 : 0) +
		(filterStatut       ? 1 : 0) +
		(filterTypeActe     ? 1 : 0) +
		(filterAgent        ? 1 : 0);

	function clearFilters() {
		searchQuery   = '';
		filterStatut  = '';
		filterTypeActe = '';
		filterAgent   = '';
	}

	// Réassignation
	let showReassignModal = false;
	let reassignAgentId = '';
	let showRemboursementModal = false;
	let remboursementRef = '';
	let savingRemboursement = false;

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

	$: escalades     = allDemandes.filter(d => isEscaladee(d) && d.escalade.level === 'superviseur');
	$: remboursements = allDemandes.filter(d => d.paiement?.remboursement?.statut === 'en_attente');
	$: stats = {
		total:          allDemandes.length,
		recues:         allDemandes.filter(d => d.statut === 'recue').length,
		en_cours:       allDemandes.filter(d => d.statut === 'en_cours').length,
		traitees:       allDemandes.filter(d => ['traitee', 'disponible'].includes(d.statut)).length,
		escalades:      escalades.length,
		remboursements: remboursements.length
	};

	// Tab base list (before text/dropdown filters)
	$: baseList = activeTab === 'escalades'
		? escalades
		: activeTab === 'remboursements'
			? remboursements
			: allDemandes;

	// Apply search + filters
	$: filteredList = (() => {
		let list = baseList;

		const q = searchQuery.trim().toLowerCase();
		if (q) {
			list = list.filter(d =>
				d.id.toLowerCase().includes(q) ||
				`${d.demandeur.prenom} ${d.demandeur.nom}`.toLowerCase().includes(q) ||
				(d.demandeur.telephone || '').includes(q)
			);
		}

		if (filterStatut)   list = list.filter(d => d.statut === filterStatut);
		if (filterTypeActe) list = list.filter(d => d.type_acte === filterTypeActe);
		if (filterAgent)    list = list.filter(d => d.agent_id === filterAgent);

		return list;
	})();

	function agentName(agentId) {
		const agent = utilisateurs?.agents?.find(a => a.id === agentId);
		return agent ? `${agent.prenom} ${agent.nom}` : agentId;
	}

	async function handleAddNote(e) {
		const { note, demandeId } = e.detail;
		await fetch(`/api/demandes/${demandeId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ note_interne: note, par: 'sup_001' })
		});
		await loadData();
		toast('Note ajoutée');
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
			toast('Escalade résolue');
		}
		saving = false;
	}

	function exportCSV() {
		const headers = ['ID', 'Statut', 'Type acte', 'Demandeur', 'Téléphone', 'Agent', 'Créée le', 'Dernière MàJ', 'Paiement'];
		const rows = allDemandes.map(d => [
			d.id,
			d.statut,
			d.type_acte,
			`${d.demandeur.prenom} ${d.demandeur.nom}`,
			d.demandeur.telephone,
			agentName(d.agent_id),
			new Date(d.created_at).toLocaleDateString('fr-FR'),
			new Date(d.updated_at).toLocaleDateString('fr-FR'),
			d.paiement?.statut || ''
		]);
		const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
		const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `civici-demandes-${new Date().toISOString().slice(0,10)}.csv`;
		a.click();
		toast('Export CSV téléchargé', 'info');
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
			toast('Dossier escaladé au Maire', 'warning');
		}
		saving = false;
	}

	async function validerRemboursement() {
		if (!selectedDemande) return;
		savingRemboursement = true;
		const res = await fetch(`/api/demandes/${selectedDemande.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ remboursement_valide: { reference: remboursementRef }, par: 'sup_001' })
		});
		if (res.ok) {
			await loadData();
			showRemboursementModal = false;
			remboursementRef = '';
			toast('Remboursement validé et enregistré');
		} else {
			toast('Erreur lors de la validation', 'error');
		}
		savingRemboursement = false;
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
			toast('Dossier réassigné avec succès');
		}
		saving = false;
	}
</script>

<svelte:head>
	<title>Superviseur – CiviCI</title>
</svelte:head>

<main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
	<!-- Header + export -->
	<div class="mb-6 flex items-start justify-between gap-4">
		<div>
			<h1 class="font-syne font-bold text-2xl text-gray-800 mb-1">Supervision — Toutes les demandes</h1>
			<p class="text-gray-500 text-sm">Vue d'ensemble de la commune. {stats.escalades > 0 ? `⚠️ ${stats.escalades} escalade(s) en attente.` : ''}</p>
		</div>
		<button
			on:click={exportCSV}
			class="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
			</svg>
			Exporter CSV
		</button>
	</div>

	<!-- KPI cards -->
	<div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
		{#each [
			{ label: 'Total',      value: stats.total,          color: 'bg-gray-50 text-gray-700'      },
			{ label: 'Reçues',     value: stats.recues,         color: 'bg-blue-50 text-blue-700'      },
			{ label: 'En cours',   value: stats.en_cours,       color: 'bg-amber-50 text-amber-700'    },
			{ label: 'Traitées',   value: stats.traitees,       color: 'bg-primary-50 text-primary-700'},
			{ label: 'Escaladées', value: stats.escalades,      color: 'bg-orange-50 text-orange-700'  }
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
		<button
			on:click={() => activeTab = 'remboursements'}
			class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 {activeTab === 'remboursements' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			💸 Remboursements
			{#if stats.remboursements > 0}
				<span class="bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none">{stats.remboursements}</span>
			{/if}
		</button>
	</div>

	<!-- ══════════════════════════════════════════════════════ -->
	<!-- Barre de recherche & filtres                           -->
	<!-- ══════════════════════════════════════════════════════ -->
	{#if activeTab !== 'remboursements'}
		<div class="mb-4 space-y-2">
			<div class="flex flex-wrap gap-2">
				<!-- Recherche texte -->
				<div class="relative flex-1 min-w-48">
					<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Rechercher par ID, nom, téléphone…"
						class="input-field pl-9 text-sm"
					/>
				</div>

				<!-- Filtre statut -->
				<select bind:value={filterStatut} class="input-field text-sm min-w-36">
					<option value="">Tous statuts</option>
					<option value="recue">Reçue</option>
					<option value="en_cours">En cours</option>
					<option value="complements_requis">Compléments requis</option>
					<option value="complements_fournis">Compléments fournis</option>
					<option value="traitee">Traitée</option>
					<option value="disponible">Disponible</option>
					<option value="rejetee">Rejetée</option>
				</select>

				<!-- Filtre type d'acte -->
				<select bind:value={filterTypeActe} class="input-field text-sm min-w-36">
					<option value="">Tous types</option>
					<option value="naissance">👶 Naissance</option>
					<option value="mariage">💍 Mariage</option>
					<option value="deces">🕊️ Décès</option>
				</select>

				<!-- Filtre agent (seulement sur "toutes") -->
				{#if activeTab === 'toutes' && utilisateurs}
					<select bind:value={filterAgent} class="input-field text-sm min-w-40">
						<option value="">Tous les agents</option>
						{#each utilisateurs.agents as agent}
							<option value={agent.id}>{agent.prenom} {agent.nom}</option>
						{/each}
					</select>
				{/if}

				<!-- Réinitialiser filtres -->
				{#if activeFiltersCount > 0}
					<button
						on:click={clearFilters}
						class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
					>
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
						Réinitialiser
						<span class="bg-gray-200 text-gray-600 text-xs font-bold px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>
					</button>
				{/if}
			</div>

			<!-- Résultats count quand filtres actifs -->
			{#if activeFiltersCount > 0}
				<p class="text-xs text-gray-500 pl-1">
					<span class="font-semibold text-gray-700">{filteredList.length}</span> résultat{filteredList.length !== 1 ? 's' : ''}
					sur {baseList.length} demande{baseList.length !== 1 ? 's' : ''}
				</p>
			{/if}
		</div>
	{/if}

	<!-- ══════════════════════════════════════════════════════ -->
	<!-- Grid liste / détail                                    -->
	<!-- ══════════════════════════════════════════════════════ -->
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
			{:else if filteredList.length === 0}
				<div class="card text-center py-12 text-gray-400">
					{#if activeFiltersCount > 0}
						<p class="text-4xl mb-2">🔍</p>
						<p class="font-medium text-gray-600">Aucun résultat</p>
						<p class="text-sm mt-1">Essayez de modifier vos critères de recherche.</p>
						<button on:click={clearFilters} class="mt-3 text-sm text-primary-600 hover:underline">
							Réinitialiser les filtres
						</button>
					{:else}
						<p class="text-4xl mb-2">✅</p>
						<p>Aucune demande dans cet onglet</p>
					{/if}
				</div>
			{:else}
				<div class="space-y-2">
					{#each filteredList as demande}
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
							{#if isSLADepassee(demande)}
								<div class="mt-1 text-xs font-semibold text-red-600 bg-red-50 rounded-lg px-2.5 py-1">
									🕐 SLA dépassé
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
					<!-- Actions escalade -->
					{#if isEscaladee(selectedDemande) && selectedDemande.escalade.level === 'superviseur'}
						<div class="bg-orange-50 border border-orange-200 rounded-xl p-4">
							<h3 class="font-semibold text-orange-800 mb-2">⚠️ Escalade à traiter</h3>
							<div class="flex gap-2 mt-2">
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

					<!-- Remboursement en attente -->
					{#if selectedDemande.paiement?.remboursement?.statut === 'en_attente'}
						<div class="card border-l-4 border-amber-400">
							<div class="flex items-start gap-3 mb-3">
								<span class="text-2xl">💸</span>
								<div>
									<h3 class="font-syne font-semibold text-amber-700">Remboursement à traiter</h3>
									<p class="text-sm text-gray-600 mt-0.5">
										Montant : <strong>{selectedDemande.paiement.montant?.toLocaleString('fr-FR')} FCFA</strong>
									</p>
									{#if selectedDemande.paiement.reference}
										<p class="text-xs text-gray-400 font-mono mt-0.5">Réf. originale : {selectedDemande.paiement.reference}</p>
									{/if}
									<p class="text-xs text-gray-400 mt-0.5">Demandé le {new Date(selectedDemande.paiement.remboursement.date_demande).toLocaleDateString('fr-FR')}</p>
								</div>
							</div>
							<button
								on:click={() => { remboursementRef = ''; showRemboursementModal = true; }}
								class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-lg transition-all"
							>
								✅ Valider le remboursement
							</button>
						</div>
					{:else if selectedDemande.paiement?.remboursement?.statut === 'effectue'}
						<div class="card border-l-4 border-green-400">
							<div class="flex items-center gap-2 text-green-700 mb-3">
								<span class="text-xl">✅</span>
								<div>
									<p class="font-semibold text-sm">Remboursement effectué</p>
									<p class="text-xs text-gray-500">Par {selectedDemande.paiement.remboursement.traite_par} · {new Date(selectedDemande.paiement.remboursement.date_remboursement).toLocaleDateString('fr-FR')}</p>
									{#if selectedDemande.paiement.remboursement.reference}
										<p class="text-xs font-mono text-gray-400">Réf. : {selectedDemande.paiement.remboursement.reference}</p>
									{/if}
								</div>
							</div>
							<button
								on:click={genBonRemboursement}
								class="w-full flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-all"
								disabled={genBonRemboursementLoading}
							>
								{#if genBonRemboursementLoading}
									<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
								{:else}
									<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
								{/if}
								Télécharger le bon de remboursement
							</button>
						</div>
					{/if}

					<!-- Réassigner -->
					<div class="card">
						<h3 class="font-syne font-semibold text-gray-700 mb-2 text-sm">Réassigner l'agent</h3>
						<p class="text-xs text-gray-400 mb-2">Agent actuel : <span class="font-medium text-gray-600">{agentName(selectedDemande.agent_id)}</span></p>
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

					<!-- Détail complet -->
					<DemandeDetailPanel
						demande={selectedDemande}
						compact={true}
						allowNotes={true}
						currentUserId="sup_001"
						currentUserRole="superviseur"
						on:addNote={handleAddNote}
					/>
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
	<div role="dialog" aria-modal="true" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={() => showEscaladeMaireModal = false} on:keydown={(e) => e.key === 'Escape' && (showEscaladeMaireModal = false)}>
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

<!-- MODAL REMBOURSEMENT -->
{#if showRemboursementModal && selectedDemande}
	<div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={() => showRemboursementModal = false}>
		<div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
			<div class="flex items-start justify-between mb-4">
				<div>
					<h3 class="font-syne font-bold text-lg text-gray-800">Valider le remboursement</h3>
					<p class="text-sm text-gray-500 mt-0.5">Dossier {selectedDemande.id}</p>
				</div>
				<button on:click={() => showRemboursementModal = false} class="text-gray-400 hover:text-gray-600 p-1">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>
			</div>

			<div class="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4">
				<div class="flex justify-between text-sm mb-1">
					<span class="text-gray-500">Demandeur</span>
					<span class="font-medium">{selectedDemande.demandeur.prenom} {selectedDemande.demandeur.nom}</span>
				</div>
				<div class="flex justify-between text-sm mb-1">
					<span class="text-gray-500">Montant à rembourser</span>
					<span class="font-bold text-amber-700">{selectedDemande.paiement.montant?.toLocaleString('fr-FR')} FCFA</span>
				</div>
				{#if selectedDemande.paiement.reference}
					<div class="flex justify-between text-sm">
						<span class="text-gray-500">Réf. transaction originale</span>
						<span class="font-mono text-xs">{selectedDemande.paiement.reference}</span>
					</div>
				{/if}
			</div>

			<div class="mb-4">
				<label class="label" for="remb-ref">Référence de remboursement <span class="text-gray-400 font-normal">(optionnel)</span></label>
				<input
					id="remb-ref"
					type="text"
					bind:value={remboursementRef}
					placeholder="Ex : REMB-MTN-2026-001"
					class="input-field font-mono text-sm"
				/>
				<p class="text-xs text-gray-400 mt-1">Numéro de transaction de remboursement Mobile Money / Orange Money.</p>
			</div>

			<div class="flex gap-3 justify-end">
				<button on:click={() => showRemboursementModal = false} class="btn-ghost">Annuler</button>
				<button
					on:click={validerRemboursement}
					class="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-all"
					disabled={savingRemboursement}
				>
					{#if savingRemboursement}
						<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
						</svg>
					{/if}
					Confirmer le remboursement
				</button>
			</div>
		</div>
	</div>
{/if}
