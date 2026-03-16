<script>
	import { onMount } from 'svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import DemandeDetailPanel from '$lib/components/DemandeDetailPanel.svelte';
	import { TYPE_ACTE_LABELS, TYPE_ACTE_ICONS, CONCERNANT_LABELS, formatDate, formatDateTime, isEscaladee } from '$lib/utils/helpers.js';

	let allDemandes = [];
	let commune = null;
	let loading = true;
	let activeTab = 'synthese';
	let selectedDemande = null;
	let saving = false;
	let actionDone = null; // { id, action }

	// ──────────────────────────────────────────────────────────
	// Chart helpers (pure SVG, no library)
	// ──────────────────────────────────────────────────────────
	const DONUT_R = 70;
	const DONUT_C = 2 * Math.PI * DONUT_R; // ≈ 439.82

	/**
	 * Builds stroke-dasharray / stroke-dashoffset data for each donut segment.
	 * Formula:
	 *   - rotate(-90) makes path start at 12 o'clock
	 *   - dashoffset = -accumulated shifts each segment to start after the previous
	 */
	function buildDonutSegments(items, total) {
		if (total === 0) return [];
		let acc = 0;
		return items.map(item => {
			const dash = (item.value / total) * DONUT_C;
			const seg = { ...item, dash, offset: -acc };
			acc += dash;
			return seg;
		});
	}

	$: donutSegments = buildDonutSegments([
		{ label: 'Reçues',      value: stats.recues,      color: '#60a5fa', bg: 'bg-blue-100',    dot: 'bg-blue-400'    },
		{ label: 'En cours',    value: stats.en_cours,    color: '#fbbf24', bg: 'bg-amber-100',   dot: 'bg-amber-400'   },
		{ label: 'Traitées',    value: stats.traitees,    color: '#34d399', bg: 'bg-emerald-100', dot: 'bg-emerald-400' },
		{ label: 'Disponibles', value: stats.disponibles, color: '#059669', bg: 'bg-green-100',   dot: 'bg-green-600'   },
		{ label: 'Rejetées',    value: stats.rejetees,    color: '#f87171', bg: 'bg-red-100',     dot: 'bg-red-400'     }
	], stats.total);

	$: typeActeData = [
		{ label: 'Actes de naissance', value: stats.naissance, icon: '👶', color: '#3b82f6', bar: 'bg-blue-400',  text: 'text-blue-600',  bg: 'bg-blue-50'   },
		{ label: 'Actes de mariage',   value: stats.mariage,   icon: '💍', color: '#f43f5e', bar: 'bg-rose-400',  text: 'text-rose-600',  bg: 'bg-rose-50'   },
		{ label: "Actes de décès",     value: stats.deces,     icon: '🕊️', color: '#64748b', bar: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-50'  }
	];

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
		total:      allDemandes.length,
		recues:     allDemandes.filter(d => d.statut === 'recue').length,
		en_cours:   allDemandes.filter(d => d.statut === 'en_cours').length,
		traitees:   allDemandes.filter(d => d.statut === 'traitee').length,
		disponibles:allDemandes.filter(d => d.statut === 'disponible').length,
		rejetees:   allDemandes.filter(d => d.statut === 'rejetee').length,
		critiques:  casCritiques.length,
		naissance:  allDemandes.filter(d => d.type_acte === 'naissance').length,
		mariage:    allDemandes.filter(d => d.type_acte === 'mariage').length,
		deces:      allDemandes.filter(d => d.type_acte === 'deces').length
	};

	$: tauxTraitement = stats.total > 0
		? Math.round((stats.traitees + stats.disponibles) / stats.total * 100)
		: 0;

	// Taux arc gauge (semi-circle): angle from -180° to 0° (left to right)
	$: gaugeAngle = -180 + (tauxTraitement / 100) * 180;
	$: gaugePath = (() => {
		const r = 54, cx = 70, cy = 70;
		const startRad = Math.PI; // 180° = left
		const endRad = Math.PI - (tauxTraitement / 100) * Math.PI;
		const sx = cx + r * Math.cos(startRad);
		const sy = cy + r * Math.sin(startRad);
		const ex = cx + r * Math.cos(endRad);
		const ey = cy + r * Math.sin(endRad);
		const large = tauxTraitement > 50 ? 1 : 0;
		return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
	})();

	// ── Journal d'audit ───────────────────────────────────────
	let auditLog = [];
	let auditLoading = false;
	let auditFilter = '';
	let auditTypeFilter = '';

	async function loadAudit() {
		auditLoading = true;
		const res = await fetch('/api/audit?limit=300');
		if (res.ok) auditLog = await res.json();
		auditLoading = false;
	}

	$: filteredAudit = auditLog.filter(e => {
		const q = auditFilter.toLowerCase();
		const matchSearch = !q || e.demande_id.toLowerCase().includes(q) || e.demandeur.toLowerCase().includes(q) || e.par.toLowerCase().includes(q) || (e.note || '').toLowerCase().includes(q);
		const matchType = !auditTypeFilter || e.action === auditTypeFilter;
		return matchSearch && matchType;
	});

	const AUDIT_LABELS = {
		changement_statut: 'Changement de statut',
		note_interne: 'Note interne',
		escalade: 'Escalade',
		remboursement: 'Remboursement'
	};
	const AUDIT_COLORS = {
		changement_statut: 'bg-blue-100 text-blue-700',
		note_interne: 'bg-indigo-100 text-indigo-700',
		escalade: 'bg-orange-100 text-orange-700',
		remboursement: 'bg-red-100 text-red-700'
	};

	async function handleAddNote(e) {
		const { note, demandeId } = e.detail;
		await fetch(`/api/demandes/${demandeId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ note_interne: note, par: 'maire_001' })
		});
		await loadData();
	}

	// ── Gestion de l'équipe ───────────────────────────────────
	let users = { agents: [], superviseurs: [], maire: null };
	let usersLoading = false;
	let showAddUser = false;
	let newUser = { prenom: '', nom: '', email: '', role: 'agent' };
	let addUserError = '';
	let editingUser = null; // { id, role, prenom, nom, email }
	let editUserError = '';

	async function loadUsers() {
		usersLoading = true;
		const res = await fetch('/api/admin');
		if (res.ok) {
			const data = await res.json();
			users = { agents: data.users?.agents || [], superviseurs: data.users?.superviseurs || [], maire: data.users?.maire || null };
		}
		usersLoading = false;
	}

	async function addUser() {
		addUserError = '';
		if (!newUser.prenom.trim() || !newUser.nom.trim() || !newUser.email.trim()) {
			addUserError = 'Tous les champs sont requis.';
			return;
		}
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'add_user', role: newUser.role, user: newUser })
		});
		if (res.ok) {
			await loadUsers();
			showAddUser = false;
			newUser = { prenom: '', nom: '', email: '', role: 'agent' };
		}
	}

	async function toggleUser(userId, role) {
		await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'toggle_user', userId, role })
		});
		await loadUsers();
	}

	async function saveEditUser() {
		editUserError = '';
		if (!editingUser.prenom.trim() || !editingUser.nom.trim() || !editingUser.email.trim()) {
			editUserError = 'Tous les champs sont requis.';
			return;
		}
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'update_user',
				userId: editingUser.id,
				role:   editingUser.role,
				data:   { prenom: editingUser.prenom, nom: editingUser.nom, email: editingUser.email }
			})
		});
		if (res.ok) {
			await loadUsers();
			editingUser = null;
		}
	}

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
		<button
			on:click={() => { activeTab = 'journal'; if (!auditLog.length) loadAudit(); }}
			class="px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'journal' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			📜 Journal d'audit
		</button>
		<button
			on:click={() => { activeTab = 'equipe'; if (!users.agents.length && !users.superviseurs.length) loadUsers(); }}
			class="px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'equipe' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}"
		>
			👥 Équipe
		</button>
	</div>

	<!-- ═══════════════════════════════════════════════════════ -->
	<!-- TAB: SYNTHESE                                           -->
	<!-- ═══════════════════════════════════════════════════════ -->
	{#if activeTab === 'synthese'}
		<div class="space-y-6">

			<!-- KPIs principaux -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
				{#each [
					{ label: 'Demandes totales', value: stats.total,                        icon: '📋', color: 'border-gray-200'   },
					{ label: 'En attente',        value: stats.recues + stats.en_cours,      icon: '⏳', color: 'border-amber-200'   },
					{ label: 'Traitées',          value: stats.traitees + stats.disponibles, icon: '✅', color: 'border-primary-200' },
					{ label: 'Cas critiques',     value: stats.critiques,                    icon: '⚠️', color: 'border-orange-200'  }
				] as kpi}
					<div class="card border-l-4 {kpi.color} pl-4">
						<div class="text-2xl mb-1">{kpi.icon}</div>
						<p class="font-syne font-bold text-3xl text-gray-800">{kpi.value}</p>
						<p class="text-sm text-gray-500">{kpi.label}</p>
					</div>
				{/each}
			</div>

			<!-- Charts row -->
			<div class="grid sm:grid-cols-2 gap-4">

				<!-- ── Donut chart : Répartition par statut ── -->
				<div class="card">
					<h2 class="font-syne font-semibold text-gray-700 mb-4">Répartition par statut</h2>

					{#if loading}
						<div class="flex items-center justify-center h-44 text-gray-300">
							<svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
							</svg>
						</div>
					{:else}
						<div class="flex items-center gap-6">
							<!-- SVG Donut -->
							<div class="flex-shrink-0">
								<svg viewBox="0 0 200 200" class="w-36 h-36" aria-label="Graphique en anneau – répartition par statut">
									<!-- Track -->
									<circle cx="100" cy="100" r="{DONUT_R}" fill="none" stroke="#f3f4f6" stroke-width="28"/>

									{#if stats.total === 0}
										<!-- Empty state ring -->
										<circle cx="100" cy="100" r="{DONUT_R}" fill="none" stroke="#e5e7eb" stroke-width="28"
											stroke-dasharray="{DONUT_C} 0"/>
									{:else}
										{#each donutSegments as seg}
											{#if seg.value > 0}
												<circle
													cx="100" cy="100" r="{DONUT_R}"
													fill="none"
													stroke="{seg.color}"
													stroke-width="28"
													stroke-dasharray="{seg.dash} {DONUT_C}"
													stroke-dashoffset="{seg.offset}"
													stroke-linecap="butt"
													transform="rotate(-90 100 100)"
												/>
											{/if}
										{/each}
									{/if}

									<!-- Center label -->
									<text x="100" y="93" text-anchor="middle" font-size="30" font-weight="700" fill="#1f2937" font-family="sans-serif">{stats.total}</text>
									<text x="100" y="113" text-anchor="middle" font-size="11" fill="#9ca3af" font-family="sans-serif">demandes</text>
								</svg>
							</div>

							<!-- Legend -->
							<div class="flex-1 space-y-1.5 min-w-0">
								{#each donutSegments as seg}
									<div class="flex items-center justify-between gap-2 text-sm">
										<div class="flex items-center gap-2 min-w-0">
											<span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: {seg.color}"></span>
											<span class="text-gray-600 truncate">{seg.label}</span>
										</div>
										<div class="flex items-center gap-1.5 flex-shrink-0">
											<span class="font-semibold text-gray-800">{seg.value}</span>
											{#if stats.total > 0}
												<span class="text-xs text-gray-400">({Math.round(seg.value / stats.total * 100)}%)</span>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- ── Bar chart : Types d'actes + Taux de traitement ── -->
				<div class="card flex flex-col gap-4">
					<div>
						<h2 class="font-syne font-semibold text-gray-700 mb-3">Répartition par type d'acte</h2>
						<div class="space-y-3">
							{#each typeActeData as item}
								{@const pct = stats.total > 0 ? Math.round(item.value / stats.total * 100) : 0}
								<div>
									<div class="flex items-center justify-between mb-1 text-sm">
										<span class="flex items-center gap-2 text-gray-700">
											<span class="text-base">{item.icon}</span>
											{item.label}
										</span>
										<span class="font-semibold {item.text}">{item.value} <span class="font-normal text-gray-400 text-xs">({pct}%)</span></span>
									</div>
									<div class="h-2.5 bg-gray-100 rounded-full overflow-hidden">
										<div
											class="h-full rounded-full transition-all duration-700 {item.bar}"
											style="width: {pct}%"
										></div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Taux de traitement gauge -->
					<div class="pt-3 border-t border-gray-100">
						<h2 class="font-syne font-semibold text-gray-700 mb-3">Taux de traitement</h2>
						<div class="flex items-end gap-6">
							<!-- Semi-circle gauge -->
							<div class="flex-shrink-0">
								<svg viewBox="0 0 140 80" class="w-32 h-20" aria-label="Jauge taux de traitement {tauxTraitement}%">
									<!-- Track arc (semi-circle) -->
									<path
										d="M 16 70 A 54 54 0 0 1 124 70"
										fill="none"
										stroke="#f3f4f6"
										stroke-width="14"
										stroke-linecap="round"
									/>
									<!-- Value arc -->
									{#if tauxTraitement > 0}
										<path
											d="{gaugePath}"
											fill="none"
											stroke="#009A44"
											stroke-width="14"
											stroke-linecap="round"
										/>
									{/if}
									<!-- Percentage text -->
									<text x="70" y="72" text-anchor="middle" font-size="20" font-weight="700" fill="#1f2937" font-family="sans-serif">{tauxTraitement}%</text>
								</svg>
							</div>
							<div class="space-y-1 pb-2">
								<div>
									<p class="text-xs text-gray-400">Traitées + Disponibles</p>
									<p class="font-syne font-bold text-xl text-primary-600">{stats.traitees + stats.disponibles}</p>
								</div>
								<div>
									<p class="text-xs text-gray-400">Délai moyen estimé</p>
									<p class="font-syne font-bold text-xl text-gray-700">~18h</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Rejected / Critical detail row -->
			{#if stats.rejetees > 0 || stats.critiques > 0}
				<div class="grid sm:grid-cols-2 gap-4">
					{#if stats.rejetees > 0}
						<div class="card border-l-4 border-red-200 flex items-center gap-4">
							<div class="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center text-2xl flex-shrink-0">❌</div>
							<div>
								<p class="font-syne font-bold text-2xl text-red-600">{stats.rejetees}</p>
								<p class="text-sm text-gray-500">demande{stats.rejetees > 1 ? 's' : ''} rejetée{stats.rejetees > 1 ? 's' : ''}</p>
							</div>
						</div>
					{/if}
					{#if stats.critiques > 0}
						<div class="card border-l-4 border-accent-200 flex items-center gap-4">
							<div class="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-2xl flex-shrink-0">⚠️</div>
							<div>
								<p class="font-syne font-bold text-2xl text-accent-600">{stats.critiques}</p>
								<p class="text-sm text-gray-500">cas critique{stats.critiques > 1 ? 's' : ''} en attente de décision</p>
							</div>
							<button
								on:click={() => activeTab = 'critiques'}
								class="ml-auto btn-accent text-sm py-2"
							>
								Traiter
							</button>
						</div>
					{/if}
				</div>
			{/if}

		</div>
	{/if}

	<!-- ═══════════════════════════════════════════════════════ -->
	<!-- TAB: CAS CRITIQUES                                      -->
	<!-- ═══════════════════════════════════════════════════════ -->
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
							<!-- Actions Maire -->
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

							<!-- Détail complet du dossier -->
							<DemandeDetailPanel
								demande={selectedDemande}
								compact={true}
								allowNotes={true}
								currentUserId="maire_001"
								currentUserRole="maire"
								on:addNote={handleAddNote}
							/>
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

	<!-- ═══════════════════════════════════════════════════════ -->
	<!-- TAB: TOUTES LES DEMANDES                               -->
	<!-- ═══════════════════════════════════════════════════════ -->
	{#if activeTab === 'toutes'}
		{#if loading}
			<div class="flex items-center justify-center py-16 text-gray-400">
				<svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
				</svg>
			</div>
		{:else}
			<div class="grid {selectedDemande ? 'lg:grid-cols-2' : ''} gap-4 items-start">
				<!-- Liste -->
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
									<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
									<tr
										on:click={() => { selectedDemande = d; actionDone = null; }}
										class="cursor-pointer hover:bg-primary-50/40 transition-colors
											{isEscaladee(d) ? 'bg-orange-50/50' : ''}
											{selectedDemande?.id === d.id ? 'bg-primary-50 border-l-2 border-primary-400' : ''}"
									>
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

				<!-- Détail -->
				{#if selectedDemande}
					<div class="space-y-3 sticky top-20">
						<div class="flex items-center justify-between">
							<h3 class="font-syne font-semibold text-gray-700 text-sm">Détail du dossier</h3>
							<button
								on:click={() => selectedDemande = null}
								class="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
								title="Fermer"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
								</svg>
							</button>
						</div>
						<DemandeDetailPanel
							demande={selectedDemande}
							compact={true}
							allowNotes={true}
							currentUserId="maire_001"
							currentUserRole="maire"
							on:addNote={handleAddNote}
						/>
					</div>
				{/if}
			</div>
		{/if}
	{/if}

	<!-- ═══════════════════════════════════════════════════════ -->
	<!-- TAB: JOURNAL D'AUDIT                                    -->
	<!-- ═══════════════════════════════════════════════════════ -->
	{#if activeTab === 'journal'}
	<div class="space-y-4">
		<!-- Filters -->
		<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
			<input
				bind:value={auditFilter}
				type="search"
				placeholder="Rechercher un dossier, agent, note…"
				class="input-field text-sm w-64"
			/>
			<select bind:value={auditTypeFilter} class="input-field text-sm w-52">
				<option value="">Tous les types d'action</option>
				<option value="changement_statut">Changements de statut</option>
				<option value="note_interne">Notes internes</option>
				<option value="escalade">Escalades</option>
				<option value="remboursement">Remboursements</option>
			</select>
			{#if auditFilter || auditTypeFilter}
				<button on:click={() => { auditFilter = ''; auditTypeFilter = ''; }} class="text-xs text-gray-500 hover:text-gray-700 underline">
					Réinitialiser
				</button>
			{/if}
			<span class="ml-auto text-xs text-gray-400">{filteredAudit.length} entrée{filteredAudit.length > 1 ? 's' : ''}</span>
		</div>

		<!-- Table -->
		<div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
			{#if auditLoading}
				<div class="flex items-center justify-center py-16 text-gray-400">
					<svg class="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
					</svg>
					Chargement du journal…
				</div>
			{:else if filteredAudit.length === 0}
				<div class="text-center py-16 text-gray-400">
					<p class="text-3xl mb-2">📜</p>
					<p class="text-sm">Aucune entrée trouvée</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-gray-50 border-b border-gray-100">
							<tr>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dossier</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Action</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Par</th>
								<th class="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Détail</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-50">
							{#each filteredAudit as entry}
								<tr class="hover:bg-gray-50 transition-colors">
									<td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
										{new Date(entry.date).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
									</td>
									<td class="px-4 py-3">
										<span class="font-mono text-xs font-semibold text-gray-800">{entry.demande_id}</span>
										<p class="text-xs text-gray-400 mt-0.5 truncate max-w-[120px]">{entry.demandeur}</p>
									</td>
									<td class="px-4 py-3 hidden sm:table-cell">
										<span class="text-xs font-medium px-2 py-0.5 rounded-full {AUDIT_COLORS[entry.action] || 'bg-gray-100 text-gray-600'}">
											{AUDIT_LABELS[entry.action] || entry.action}
										</span>
									</td>
									<td class="px-4 py-3 text-xs text-gray-600 hidden md:table-cell">{entry.par}</td>
									<td class="px-4 py-3 text-xs text-gray-500 max-w-xs">
										{#if entry.statut && entry.action === 'changement_statut'}
											<span class="text-gray-700">→ <strong>{entry.statut}</strong></span>
										{/if}
										{#if entry.note}
											<span class="italic text-gray-500 line-clamp-2">{entry.note}</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
	{/if}

	<!-- ═══════════════════════════════════════════════════════ -->
	<!-- TAB: ÉQUIPE                                             -->
	<!-- ═══════════════════════════════════════════════════════ -->
	{#if activeTab === 'equipe'}
		<div class="space-y-6">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="font-syne font-bold text-xl text-gray-800">Gestion de l'équipe</h2>
					<p class="text-sm text-gray-500 mt-0.5">Agents, superviseurs et compte Maire.</p>
				</div>
				<button
					on:click={() => { showAddUser = !showAddUser; addUserError = ''; }}
					class="btn-primary text-sm flex items-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
					</svg>
					Nouvel utilisateur
				</button>
			</div>

			{#if usersLoading}
				<div class="flex justify-center py-10 text-gray-400">
					<svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
					</svg>
				</div>
			{:else}

			<!-- Formulaire ajout -->
			{#if showAddUser}
				<div class="card">
					<h3 class="font-syne font-semibold text-gray-700 mb-4">Ajouter un utilisateur</h3>
					<div class="grid sm:grid-cols-2 gap-4 mb-4">
						<div>
							<label class="label text-xs">Prénom</label>
							<input type="text" bind:value={newUser.prenom} class="input-field text-sm" placeholder="Aminata"/>
						</div>
						<div>
							<label class="label text-xs">Nom</label>
							<input type="text" bind:value={newUser.nom} class="input-field text-sm" placeholder="KONÉ"/>
						</div>
						<div>
							<label class="label text-xs">Email</label>
							<input type="email" bind:value={newUser.email} class="input-field text-sm" placeholder="email@mairie.ci"/>
						</div>
						<div>
							<label class="label text-xs">Rôle</label>
							<select bind:value={newUser.role} class="input-field text-sm">
								<option value="agent">Agent</option>
								<option value="superviseur">Superviseur</option>
							</select>
						</div>
					</div>
					{#if addUserError}<p class="text-xs text-red-500 mb-3">{addUserError}</p>{/if}
					<div class="flex gap-3">
						<button on:click={addUser} class="btn-primary text-sm">Ajouter</button>
						<button on:click={() => showAddUser = false} class="btn-secondary text-sm">Annuler</button>
					</div>
				</div>
			{/if}

			<!-- Agents -->
			<div>
				<h3 class="font-syne font-semibold text-gray-600 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
					<span class="w-2 h-2 bg-blue-400 rounded-full"></span>
					Agents ({users.agents.length})
				</h3>
				<div class="space-y-2">
					{#each users.agents as agent (agent.id)}
						{#if editingUser?.id === agent.id}
							<!-- Edit row -->
							<div class="card border-2 border-primary-200">
								<div class="grid sm:grid-cols-3 gap-3 mb-3">
									<input bind:value={editingUser.prenom} class="input-field text-sm" placeholder="Prénom"/>
									<input bind:value={editingUser.nom} class="input-field text-sm" placeholder="Nom"/>
									<input bind:value={editingUser.email} type="email" class="input-field text-sm" placeholder="Email"/>
								</div>
								{#if editUserError}<p class="text-xs text-red-500 mb-2">{editUserError}</p>{/if}
								<div class="flex gap-2">
									<button on:click={saveEditUser} class="btn-primary text-xs py-1.5">Enregistrer</button>
									<button on:click={() => editingUser = null} class="btn-secondary text-xs py-1.5">Annuler</button>
								</div>
							</div>
						{:else}
							<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
								<div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center font-syne font-bold text-blue-700 text-sm flex-shrink-0">
									{agent.avatar}
								</div>
								<div class="flex-1 min-w-0">
									<p class="font-medium text-gray-800 text-sm">{agent.prenom} {agent.nom}</p>
									<p class="text-xs text-gray-400 truncate">{agent.email}</p>
								</div>
								<span class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0
									{agent.actif !== false ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}">
									{agent.actif !== false ? 'Actif' : 'Inactif'}
								</span>
								<button
									on:click={() => editingUser = { ...agent }}
									class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all flex-shrink-0"
								>Modifier</button>
								<button
									on:click={() => toggleUser(agent.id, 'agent')}
									class="text-xs px-3 py-1.5 rounded-lg border transition-all flex-shrink-0
										{agent.actif !== false ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-primary-200 text-primary-600 hover:bg-primary-50'}"
								>
									{agent.actif !== false ? 'Désactiver' : 'Réactiver'}
								</button>
							</div>
						{/if}
					{/each}
					{#if users.agents.length === 0}
						<p class="text-sm text-gray-400 py-3 text-center">Aucun agent</p>
					{/if}
				</div>
			</div>

			<!-- Superviseurs -->
			<div>
				<h3 class="font-syne font-semibold text-gray-600 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
					<span class="w-2 h-2 bg-violet-400 rounded-full"></span>
					Superviseurs ({users.superviseurs.length})
				</h3>
				<div class="space-y-2">
					{#each users.superviseurs as sup (sup.id)}
						{#if editingUser?.id === sup.id}
							<div class="card border-2 border-primary-200">
								<div class="grid sm:grid-cols-3 gap-3 mb-3">
									<input bind:value={editingUser.prenom} class="input-field text-sm" placeholder="Prénom"/>
									<input bind:value={editingUser.nom} class="input-field text-sm" placeholder="Nom"/>
									<input bind:value={editingUser.email} type="email" class="input-field text-sm" placeholder="Email"/>
								</div>
								{#if editUserError}<p class="text-xs text-red-500 mb-2">{editUserError}</p>{/if}
								<div class="flex gap-2">
									<button on:click={saveEditUser} class="btn-primary text-xs py-1.5">Enregistrer</button>
									<button on:click={() => editingUser = null} class="btn-secondary text-xs py-1.5">Annuler</button>
								</div>
							</div>
						{:else}
							<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
								<div class="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center font-syne font-bold text-violet-700 text-sm flex-shrink-0">
									{sup.avatar}
								</div>
								<div class="flex-1 min-w-0">
									<p class="font-medium text-gray-800 text-sm">{sup.prenom} {sup.nom}</p>
									<p class="text-xs text-gray-400 truncate">{sup.email}</p>
								</div>
								<span class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0
									{sup.actif !== false ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}">
									{sup.actif !== false ? 'Actif' : 'Inactif'}
								</span>
								<button
									on:click={() => editingUser = { ...sup }}
									class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all flex-shrink-0"
								>Modifier</button>
								<button
									on:click={() => toggleUser(sup.id, 'superviseur')}
									class="text-xs px-3 py-1.5 rounded-lg border transition-all flex-shrink-0
										{sup.actif !== false ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-primary-200 text-primary-600 hover:bg-primary-50'}"
								>
									{sup.actif !== false ? 'Désactiver' : 'Réactiver'}
								</button>
							</div>
						{/if}
					{/each}
					{#if users.superviseurs.length === 0}
						<p class="text-sm text-gray-400 py-3 text-center">Aucun superviseur</p>
					{/if}
				</div>
			</div>

			<!-- Compte Maire -->
			{#if users.maire}
				<div>
					<h3 class="font-syne font-semibold text-gray-600 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
						<span class="w-2 h-2 bg-primary-400 rounded-full"></span>
						Compte Maire
					</h3>
					{#if editingUser?.id === users.maire.id}
						<div class="card border-2 border-primary-200">
							<div class="grid sm:grid-cols-3 gap-3 mb-3">
								<input bind:value={editingUser.prenom} class="input-field text-sm" placeholder="Prénom"/>
								<input bind:value={editingUser.nom} class="input-field text-sm" placeholder="Nom"/>
								<input bind:value={editingUser.email} type="email" class="input-field text-sm" placeholder="Email"/>
							</div>
							{#if editUserError}<p class="text-xs text-red-500 mb-2">{editUserError}</p>{/if}
							<div class="flex gap-2">
								<button on:click={saveEditUser} class="btn-primary text-xs py-1.5">Enregistrer</button>
								<button on:click={() => editingUser = null} class="btn-secondary text-xs py-1.5">Annuler</button>
							</div>
						</div>
					{:else}
						<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
							<div class="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center font-syne font-bold text-primary-700 text-sm flex-shrink-0">
								{users.maire.avatar}
							</div>
							<div class="flex-1 min-w-0">
								<p class="font-medium text-gray-800 text-sm">{users.maire.prenom} {users.maire.nom}</p>
								<p class="text-xs text-gray-400 truncate">{users.maire.email}</p>
							</div>
							<span class="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Maire</span>
							<button
								on:click={() => editingUser = { ...users.maire }}
								class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
							>Modifier</button>
						</div>
					{/if}
				</div>
			{/if}

			{/if}
		</div>
	{/if}

</main>
