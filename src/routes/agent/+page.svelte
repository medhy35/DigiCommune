<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { TYPE_ACTE_LABELS, TYPE_ACTE_ICONS, formatDateTime, timeAgo, isEscaladee, isSLADepassee, RDV_STATUT_LABELS, RDV_STATUT_COLORS } from '$lib/utils/helpers.js';

	let demandes = [];
	let loading = true;
	let filterStatut = '';
	let filterType = '';
	let searchTerm = '';

	let rdvList    = [];
	let rdvLoading = false;
	let rdvView    = 'aujd'; // 'aujd' | 'avenir' | 'tous'
	let rdvModuleActif = false;
	let showRdvPanel = false;

	onMount(async () => {
		await Promise.all([loadDemandes(), loadRdv()]);
	});

	async function loadRdv() {
		rdvLoading = true;
		const [rRes, sRes] = await Promise.all([fetch('/api/rdv'), fetch('/api/settings?role=global')]);
		if (rRes.ok) rdvList = await rRes.json();
		if (sRes.ok) {
			const sd = await sRes.json();
			rdvModuleActif = sd.settings?.global?.modules?.rdv === true;
		}
		rdvLoading = false;
	}

	async function updateRdvStatut(id, statut) {
		await fetch(`/api/rdv/${id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ statut }) });
		await loadRdv();
	}

	async function annulerRdvAgent(id) {
		await fetch(`/api/rdv/${id}?acteur=agent`, { method: 'DELETE' });
		await loadRdv();
	}

	function rdvDateLabel(dateStr) {
		const today = new Date().toISOString().slice(0,10);
		const tom   = new Date(Date.now() + 86400000).toISOString().slice(0,10);
		if (dateStr === today) return "Aujourd'hui";
		if (dateStr === tom)   return 'Demain';
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' });
	}

	$: rdvFiltered = (() => {
		const today = new Date().toISOString().slice(0,10);
		if (rdvView === 'aujd')   return rdvList.filter(r => r.date_rdv === today && r.statut !== 'annule');
		if (rdvView === 'avenir') return rdvList.filter(r => r.date_rdv >= today && r.statut !== 'annule' && r.statut !== 'effectue');
		return rdvList;
	})();

	async function loadDemandes() {
		loading = true;
		const res = await fetch('/api/demandes?agent_id=agent_001');
		demandes = await res.json();
		// Sort: escalated first, then by date desc
		demandes.sort((a, b) => {
			if (isEscaladee(a) && !isEscaladee(b)) return -1;
			if (!isEscaladee(a) && isEscaladee(b)) return 1;
			return new Date(b.created_at) - new Date(a.created_at);
		});
		loading = false;
	}

	$: filtered = demandes.filter(d => {
		const matchStatut = !filterStatut || d.statut === filterStatut;
		const matchType = !filterType || d.type_acte === filterType;
		const matchSearch = !searchTerm || d.id.includes(searchTerm.toUpperCase()) ||
			d.demandeur.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
			d.demandeur.prenom.toLowerCase().includes(searchTerm.toLowerCase());
		return matchStatut && matchType && matchSearch;
	});

	$: stats = {
		nouvelles: demandes.filter(d => d.statut === 'recue').length,
		en_cours: demandes.filter(d => d.statut === 'en_cours').length,
		traitees: demandes.filter(d => d.statut === 'traitee' || d.statut === 'disponible').length,
		escaladees: demandes.filter(isEscaladee).length
	};
</script>

<svelte:head>
	<title>Tableau de bord Agent – CiviCI</title>
</svelte:head>

<main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
	<!-- Welcome + Stats -->
	<div class="mb-6">
		<h1 class="font-syne font-bold text-2xl text-gray-800 mb-1">Bonjour, Awa 👋</h1>
		<p class="text-gray-500 text-sm">Voici l'état de vos demandes assignées.</p>
	</div>

	<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
		{#each [
			{ label: 'Nouvelles', value: stats.nouvelles, color: 'bg-blue-50 text-blue-700', icon: '📋' },
			{ label: 'En cours', value: stats.en_cours, color: 'bg-amber-50 text-amber-700', icon: '⚙️' },
			{ label: 'Traitées', value: stats.traitees, color: 'bg-primary-50 text-primary-700', icon: '✅' },
			{ label: 'Escaladées', value: stats.escaladees, color: 'bg-orange-50 text-orange-700', icon: '⚠️' }
		] as stat}
			<div class="card p-4">
				<div class="flex items-center justify-between mb-1">
					<span class="text-2xl">{stat.icon}</span>
					{#if stat.label === 'Escaladées' && stat.value > 0}
						<span class="w-2.5 h-2.5 bg-accent-500 rounded-full animate-pulse"></span>
					{/if}
				</div>
				<p class="font-syne font-bold text-3xl text-gray-800">{stat.value}</p>
				<p class="text-sm text-gray-500">{stat.label}</p>
			</div>
		{/each}
	</div>

	<!-- ── Panneau RDV ─────────────────────────────────────────────── -->
	{#if rdvModuleActif}
		<div class="card mb-6">
			<div class="flex items-center justify-between mb-3">
				<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">
					📅 Rendez-vous
					{#if rdvFiltered.filter(r => r.statut === 'en_attente').length > 0}
						<span class="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
							{rdvFiltered.filter(r => r.statut === 'en_attente').length}
						</span>
					{/if}
				</h2>
				<div class="flex gap-2">
					{#each [['aujd', "Aujourd'hui"], ['avenir', 'À venir'], ['tous', 'Tous']] as [v, l]}
						<button on:click={() => rdvView = v}
							class="text-xs px-3 py-1 rounded-lg font-medium transition-all
								{rdvView === v ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
							{l}
						</button>
					{/each}
				</div>
			</div>

			{#if rdvLoading}
				<p class="text-sm text-gray-400 py-4 text-center">Chargement des rendez-vous…</p>
			{:else if rdvFiltered.length === 0}
				<p class="text-sm text-gray-400 py-4 text-center">Aucun rendez-vous pour cette période.</p>
			{:else}
				<div class="space-y-2">
					{#each rdvFiltered as rdv}
						<div class="flex items-center gap-3 rounded-xl border border-gray-100 p-3 bg-gray-50 hover:bg-white transition-all">
							<div class="w-12 text-center flex-shrink-0">
								<p class="text-xs font-bold text-primary-600">{rdvDateLabel(rdv.date_rdv)}</p>
								<p class="text-lg font-syne font-bold text-gray-800">{rdv.heure_rdv}</p>
							</div>
							<div class="w-px h-10 bg-gray-200 flex-shrink-0"></div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-800 truncate">{rdv.demandeur?.prenom} {rdv.demandeur?.nom}</p>
								<p class="text-xs text-gray-400">{rdv.demande_id} · {rdv.demandeur?.telephone || '—'}</p>
							</div>
							<span class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 {RDV_STATUT_COLORS[rdv.statut]}">
								{RDV_STATUT_LABELS[rdv.statut] || rdv.statut}
							</span>
							<!-- Actions -->
							{#if rdv.statut === 'en_attente'}
								<button on:click={() => updateRdvStatut(rdv.id, 'confirme')}
									class="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 flex-shrink-0">✓ Confirmer</button>
							{:else if rdv.statut === 'confirme'}
								<button on:click={() => updateRdvStatut(rdv.id, 'effectue')}
									class="text-xs px-2 py-1 rounded-lg bg-primary-100 text-primary-700 hover:bg-primary-200 flex-shrink-0">✓ Marquer effectué</button>
							{/if}
							{#if rdv.statut !== 'effectue' && rdv.statut !== 'annule'}
								<button on:click={() => annulerRdvAgent(rdv.id)}
									class="text-xs px-2 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex-shrink-0">✕</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Filters -->
	<div class="card mb-4">
		<div class="flex flex-col sm:flex-row gap-3">
			<input
				type="text"
				bind:value={searchTerm}
				placeholder="Rechercher par N° ou nom..."
				class="input-field flex-1 text-sm"
			/>
			<select bind:value={filterStatut} class="input-field text-sm sm:w-44">
				<option value="">Tous les statuts</option>
				<option value="recue">Reçue</option>
				<option value="en_cours">En cours</option>
				<option value="traitee">Traitée</option>
				<option value="disponible">Disponible</option>
			</select>
			<select bind:value={filterType} class="input-field text-sm sm:w-44">
				<option value="">Tous les types</option>
				<option value="naissance">Naissance</option>
				<option value="mariage">Mariage</option>
				<option value="deces">Décès</option>
			</select>
		</div>
	</div>

	<!-- Liste demandes -->
	{#if loading}
		<div class="flex items-center justify-center py-20 text-gray-400">
			<svg class="w-8 h-8 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
			</svg>
			Chargement...
		</div>
	{:else if filtered.length === 0}
		<div class="card text-center py-12 text-gray-400">
			<p class="text-4xl mb-3">📭</p>
			<p class="font-medium">Aucune demande trouvée</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each filtered as demande}
				<button
					on:click={() => goto(`/agent/demande/${demande.id}`)}
					class="w-full card p-4 text-left hover:shadow-card-hover transition-all hover:border-primary-200 border border-transparent group"
					class:border-orange-200={isEscaladee(demande)}
					class:bg-orange-50={isEscaladee(demande)}
				>
					<div class="flex items-center justify-between gap-4">
						<div class="flex items-center gap-3 min-w-0">
							<span class="text-2xl flex-shrink-0">{TYPE_ACTE_ICONS[demande.type_acte]}</span>
							<div class="min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<span class="font-mono font-semibold text-gray-800 text-sm">{demande.id}</span>
									<StatusBadge {demande} />
									{#if isEscaladee(demande)}
										<span class="badge-escaladee">
											⚠️ Escalade {demande.escalade.level}
										</span>
									{/if}
									{#if isSLADepassee(demande)}
										<span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">🕐 SLA dépassé</span>
									{/if}
								</div>
								<p class="text-sm text-gray-600 mt-0.5 truncate">
									{demande.demandeur.prenom} {demande.demandeur.nom} — {TYPE_ACTE_LABELS[demande.type_acte]}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-3 flex-shrink-0">
							<span class="text-xs text-gray-400 hidden sm:block">{timeAgo(demande.created_at)}</span>
							<svg class="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
							</svg>
						</div>
					</div>
				</button>
			{/each}
		</div>
		<p class="text-center text-xs text-gray-400 mt-4">{filtered.length} demande{filtered.length > 1 ? 's' : ''}</p>
	{/if}
</main>
