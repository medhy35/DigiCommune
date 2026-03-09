<script>
	import { onMount } from 'svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Timeline from '$lib/components/Timeline.svelte';
	import { TYPE_ACTE_LABELS, TYPE_ACTE_ICONS, CONCERNANT_LABELS, formatDate, formatDateTime, isEscaladee } from '$lib/utils/helpers.js';

	let allDemandes = [];
	let commune = null;
	let loading = true;
	let activeTab = 'synthese';
	let selectedDemande = null;
	let saving = false;
	let actionDone = null; // { id, action }

	onMount(async () => {
		const tab = new URL(window.location.href).searchParams.get('tab');
		if (tab === 'critiques') activeTab = 'critiques';
		await loadData();
	});

	async function loadData() {
		loading = true;
		const [dRes, cRes] = await Promise.all([
			fetch('/api/demandes'),
			fetch('/api/commune')
		]);
		allDemandes = await dRes.json();
		commune = await cRes.json();
		if (selectedDemande) {
			selectedDemande = allDemandes.find(d => d.id === selectedDemande.id) || null;
		}
		loading = false;
	}

	$: casCritiques = allDemandes.filter(d => isEscaladee(d) && d.escalade.level === 'maire');

	$: stats = {
		total: allDemandes.length,
		recues: allDemandes.filter(d => d.statut === 'recue').length,
		en_cours: allDemandes.filter(d => d.statut === 'en_cours').length,
		traitees: allDemandes.filter(d => d.statut === 'traitee').length,
		disponibles: allDemandes.filter(d => d.statut === 'disponible').length,
		rejetees: allDemandes.filter(d => d.statut === 'rejetee').length,
		critiques: casCritiques.length,
		naissance: allDemandes.filter(d => d.type_acte === 'naissance').length,
		mariage: allDemandes.filter(d => d.type_acte === 'mariage').length,
		deces: allDemandes.filter(d => d.type_acte === 'deces').length
	};

	async function actionMaire(action) {
		saving = true;
		const newStatut = action === 'valider' ? 'disponible' : 'rejetee';
		const res = await fetch(`/api/demandes/${selectedDemande.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				statut: newStatut,
				escalade: null,
				note: action === 'valider' ? 'Validé par le Maire' : 'Rejeté par le Maire',
				par: 'maire_001'
			})
		});
		if (res.ok) {
			actionDone = { id: selectedDemande.id, action };
			await loadData();
		}
		saving = false;
	}
</script>

<svelte:head>
	<title>Tableau de bord Maire – CiviCI</title>
</svelte:head>

<main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
	<div class="mb-6">
		<h1 class="font-syne font-bold text-2xl text-gray-800 mb-1">
			Tableau de bord — {commune?.nom || 'Mairie'}
		</h1>
		<p class="text-gray-500 text-sm">
			Vue synthétique et cas critiques.
			{#if stats.critiques > 0}
				<span class="text-accent-600 font-medium">⚠️ {stats.critiques} cas critique(s) nécessitent votre décision.</span>
			{/if}
		</p>
	</div>

	<!-- Tabs -->
	<div class="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
		<button
			on:click={() => activeTab = 'synthese'}
			class="px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'synthese' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			📊 Vue synthétique
		</button>
		<button
			on:click={() => activeTab = 'critiques'}
			class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 {activeTab === 'critiques' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			⚠️ Cas critiques
			{#if stats.critiques > 0}
				<span class="bg-accent-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{stats.critiques}</span>
			{/if}
		</button>
		<button
			on:click={() => activeTab = 'toutes'}
			class="px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'toutes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			📋 Toutes les demandes
		</button>
	</div>

	<!-- TAB: SYNTHESE -->
	{#if activeTab === 'synthese'}
		<div class="space-y-6">
			<!-- KPIs principaux -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
				{#each [
					{ label: 'Demandes totales', value: stats.total, icon: '📋', color: 'border-gray-200' },
					{ label: 'En attente', value: stats.recues + stats.en_cours, icon: '⏳', color: 'border-amber-200' },
					{ label: 'Traitées', value: stats.traitees + stats.disponibles, icon: '✅', color: 'border-primary-200' },
					{ label: 'Cas critiques', value: stats.critiques, icon: '⚠️', color: 'border-orange-200' }
				] as kpi}
					<div class="card border-l-4 {kpi.color} pl-4">
						<div class="text-2xl mb-1">{kpi.icon}</div>
						<p class="font-syne font-bold text-3xl text-gray-800">{kpi.value}</p>
						<p class="text-sm text-gray-500">{kpi.label}</p>
					</div>
				{/each}
			</div>

			<!-- Répartition par statut -->
			<div class="grid sm:grid-cols-2 gap-4">
				<div class="card">
					<h2 class="font-syne font-semibold text-gray-700 mb-4">Répartition par statut</h2>
					<div class="space-y-3">
						{#each [
							{ label: 'Reçues', value: stats.recues, color: 'bg-blue-400', pct: stats.total > 0 ? (stats.recues / stats.total * 100) : 0 },
							{ label: 'En cours', value: stats.en_cours, color: 'bg-amber-400', pct: stats.total > 0 ? (stats.en_cours / stats.total * 100) : 0 },
							{ label: 'Traitées', value: stats.traitees, color: 'bg-primary-400', pct: stats.total > 0 ? (stats.traitees / stats.total * 100) : 0 },
							{ label: 'Disponibles', value: stats.disponibles, color: 'bg-primary-600', pct: stats.total > 0 ? (stats.disponibles / stats.total * 100) : 0 },
							{ label: 'Rejetées', value: stats.rejetees, color: 'bg-red-400', pct: stats.total > 0 ? (stats.rejetees / stats.total * 100) : 0 }
						] as row}
							<div class="flex items-center gap-3 text-sm">
								<span class="w-24 text-gray-600">{row.label}</span>
								<div class="flex-1 bg-gray-100 rounded-full h-2">
									<div class="h-2 rounded-full {row.color} transition-all" style="width: {row.pct}%"></div>
								</div>
								<span class="w-6 text-right font-semibold text-gray-700">{row.value}</span>
							</div>
						{/each}
					</div>
				</div>

				<div class="card">
					<h2 class="font-syne font-semibold text-gray-700 mb-4">Répartition par type d'acte</h2>
					<div class="space-y-4">
						{#each [
							{ label: 'Actes de naissance', value: stats.naissance, icon: '👶', color: 'text-blue-600', bg: 'bg-blue-50' },
							{ label: 'Actes de mariage', value: stats.mariage, icon: '💍', color: 'text-rose-600', bg: 'bg-rose-50' },
							{ label: 'Actes de décès', value: stats.deces, icon: '🕊️', color: 'text-slate-600', bg: 'bg-slate-50' }
						] as item}
							<div class="flex items-center justify-between p-3 rounded-xl {item.bg}">
								<div class="flex items-center gap-3">
									<span class="text-2xl">{item.icon}</span>
									<span class="text-sm font-medium text-gray-700">{item.label}</span>
								</div>
								<span class="font-syne font-bold text-2xl {item.color}">{item.value}</span>
							</div>
						{/each}
					</div>

					<div class="mt-4 pt-4 border-t border-gray-100">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-xs text-gray-400">Taux de traitement</p>
								<p class="font-syne font-bold text-2xl text-primary-600">
									{stats.total > 0 ? Math.round((stats.traitees + stats.disponibles) / stats.total * 100) : 0}%
								</p>
							</div>
							<div>
								<p class="text-xs text-gray-400">Délai moyen estimé</p>
								<p class="font-syne font-bold text-2xl text-gray-700">~18h</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- TAB: CAS CRITIQUES -->
	{#if activeTab === 'critiques'}
		{#if casCritiques.length === 0}
			<div class="card text-center py-16 text-gray-400">
				<p class="text-5xl mb-3">✅</p>
				<p class="font-semibold text-gray-600">Aucun cas critique en attente</p>
				<p class="text-sm mt-1">Toutes les escalades ont été résolues.</p>
			</div>
		{:else}
			<div class="grid lg:grid-cols-2 gap-4">
				<!-- Liste cas critiques -->
				<div class="space-y-3">
					{#each casCritiques as demande}
						<button
							on:click={() => { selectedDemande = demande; actionDone = null; }}
							class="w-full card p-4 text-left border-2 transition-all
								{selectedDemande?.id === demande.id ? 'border-accent-400 bg-accent-50/30' : 'border-orange-200 hover:border-orange-300 bg-orange-50/30'}"
						>
							<div class="flex items-start justify-between gap-2">
								<div class="flex items-start gap-3">
									<span class="text-2xl mt-0.5">{TYPE_ACTE_ICONS[demande.type_acte]}</span>
									<div>
										<span class="font-mono font-semibold text-gray-800">{demande.id}</span>
										<p class="text-sm text-gray-600 mt-0.5">
											{demande.demandeur.prenom} {demande.demandeur.nom} — {TYPE_ACTE_LABELS[demande.type_acte]}
										</p>
										<p class="text-xs text-orange-700 mt-1 bg-orange-100 rounded-lg px-2 py-1 leading-relaxed">
											{demande.escalade.motif}
										</p>
									</div>
								</div>
							</div>
						</button>
					{/each}
				</div>

				<!-- Detail & Actions -->
				<div>
					{#if selectedDemande && isEscaladee(selectedDemande)}
						<div class="space-y-4">
							<div class="card">
								<div class="flex items-start justify-between mb-3">
									<div>
										<span class="font-mono font-bold text-lg text-gray-800">{selectedDemande.id}</span>
										<StatusBadge demande={selectedDemande} />
									</div>
									<span class="text-3xl">{TYPE_ACTE_ICONS[selectedDemande.type_acte]}</span>
								</div>
								<dl class="grid grid-cols-2 gap-2 text-sm">
									<div><dt class="text-xs text-gray-400">Demandeur</dt><dd class="font-medium mt-0.5">{selectedDemande.demandeur.prenom} {selectedDemande.demandeur.nom}</dd></div>
									<div><dt class="text-xs text-gray-400">Téléphone</dt><dd class="font-medium mt-0.5">{selectedDemande.demandeur.telephone}</dd></div>
									<div><dt class="text-xs text-gray-400">Type d'acte</dt><dd class="font-medium mt-0.5">{TYPE_ACTE_LABELS[selectedDemande.type_acte]}</dd></div>
									<div><dt class="text-xs text-gray-400">Concernant</dt><dd class="font-medium mt-0.5">{CONCERNANT_LABELS[selectedDemande.concernant]}</dd></div>
								</dl>
							</div>

							<!-- Motif escalade -->
							<div class="bg-orange-50 border border-orange-200 rounded-xl p-4">
								<h3 class="font-semibold text-orange-800 mb-1">Motif de l'escalade</h3>
								<p class="text-sm text-orange-700">{selectedDemande.escalade.motif}</p>
								<p class="text-xs text-orange-500 mt-2">{formatDateTime(selectedDemande.escalade.date)}</p>
							</div>

							<!-- Actions Maire (LECTURE + DÉCISION) -->
							{#if actionDone?.id === selectedDemande.id}
								<div class="card text-center py-6">
									<p class="text-3xl mb-2">{actionDone.action === 'valider' ? '✅' : '❌'}</p>
									<p class="font-semibold text-gray-700">
										{actionDone.action === 'valider' ? 'Demande validée' : 'Demande rejetée'}
									</p>
									<p class="text-sm text-gray-500 mt-1">Décision enregistrée avec succès.</p>
								</div>
							{:else}
								<div class="card">
									<h3 class="font-syne font-semibold text-gray-700 mb-1">Votre décision</h3>
									<p class="text-xs text-gray-500 mb-4">En tant que Maire, vous avez le dernier mot sur ce dossier.</p>
									<div class="flex gap-3">
										<button
											on:click={() => actionMaire('valider')}
											class="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
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
											Valider
										</button>
										<button
											on:click={() => actionMaire('rejeter')}
											class="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
											disabled={saving}
										>
											❌ Rejeter
										</button>
									</div>
								</div>
							{/if}

							<!-- Timeline -->
							<div class="card">
								<h3 class="font-syne font-semibold text-gray-700 mb-3 text-sm">Historique complet</h3>
								<Timeline historique={selectedDemande.historique} statut={selectedDemande.statut} />
							</div>
						</div>
					{:else}
						<div class="card text-center py-16 text-gray-400">
							<p class="text-4xl mb-3">👈</p>
							<p class="text-sm">Sélectionnez un cas critique pour prendre une décision</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}

	<!-- TAB: TOUTES LES DEMANDES (lecture seule) -->
	{#if activeTab === 'toutes'}
		{#if loading}
			<div class="flex items-center justify-center py-16 text-gray-400">
				<svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
				</svg>
			</div>
		{:else}
			<div class="card overflow-hidden p-0">
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 border-b border-gray-100">
							<tr>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dossier</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Demandeur</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Date</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-50">
							{#each allDemandes as d}
								<tr class="hover:bg-gray-50 transition-colors {isEscaladee(d) ? 'bg-orange-50/50' : ''}">
									<td class="px-4 py-3 font-mono text-xs font-semibold text-gray-800">{d.id}</td>
									<td class="px-4 py-3 hidden sm:table-cell">
										<span>{TYPE_ACTE_ICONS[d.type_acte]}</span>
										<span class="text-gray-600 ml-1">{TYPE_ACTE_LABELS[d.type_acte]}</span>
									</td>
									<td class="px-4 py-3 text-gray-700">{d.demandeur.prenom} {d.demandeur.nom}</td>
									<td class="px-4 py-3 text-gray-500 hidden md:table-cell">{formatDate(d.created_at)}</td>
									<td class="px-4 py-3"><StatusBadge demande={d} /></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</main>
