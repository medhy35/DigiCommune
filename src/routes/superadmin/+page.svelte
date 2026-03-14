<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authRole } from '$lib/stores/auth.js';
	import { TYPE_ACTE_LABELS, TYPE_ACTE_ICONS } from '$lib/utils/helpers.js';

	let activeTab = 'overview';
	let loading = true;
	let saving = false;
	let toast = null;

	let stats = {};
	let par_type = {};
	let settings = {};
	let users = { agents: [], superviseurs: [], maire: null };
	let commune = {};

	// Formulaire nouvel utilisateur
	let showAddUser = false;
	let newUser = { prenom: '', nom: '', email: '', role: 'agent' };
	let addUserError = '';

	// Formulaire verrouillage
	const LOCKABLE_PARAMS = [
		{ key: 'sla_heures',           label: 'SLA Agent (heures)',            role: 'agent' },
		{ key: 'seuil_escalades_alerte',label: 'Seuil alertes escalades',       role: 'superviseur' },
		{ key: 'periode_dashboard',    label: 'Période dashboard Maire',        role: 'maire' },
		{ key: 'frais_copie',          label: 'Frais copie (FCFA)',             role: 'global' },
		{ key: 'frais_copie_integrale',label: 'Frais copie intégrale (FCFA)',   role: 'global' },
		{ key: 'sla_heures_defaut',    label: 'SLA par défaut (heures)',        role: 'global' }
	];

	// Formulaire paramètres globaux éditables
	let globalEdit = {};
	let communeEdit = {};

	const TABS = [
		{ id: 'overview',  label: 'Vue d\'ensemble', icon: '📊' },
		{ id: 'modules',   label: 'Modules',         icon: '🧩' },
		{ id: 'users',     label: 'Utilisateurs',    icon: '👥' },
		{ id: 'params',    label: 'Paramètres',      icon: '⚙️' },
		{ id: 'locks',     label: 'Verrouillages',   icon: '🔒' }
	];

	onMount(async () => {
		await loadAll();
	});

	async function loadAll() {
		loading = true;
		const [adminRes, communeRes] = await Promise.all([
			fetch('/api/admin'),
			fetch('/api/commune')
		]);
		if (adminRes.ok) {
			const data = await adminRes.json();
			stats = data.stats;
			par_type = data.par_type;
			settings = data.settings;
			users = data.users;
			globalEdit = { ...(data.settings.global || {}) };
			delete globalEdit.modules;
			delete globalEdit.locked_params;
		}
		if (communeRes.ok) {
			commune = await communeRes.json();
			communeEdit = { ...commune };
		}
		loading = false;
	}

	function showToast(msg, type = 'success') {
		toast = { msg, type };
		setTimeout(() => toast = null, 3000);
	}

	async function toggleModule(key) {
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'toggle_module', module: key })
		});
		if (res.ok) {
			const d = await res.json();
			settings.global.modules[key] = d.enabled;
			settings = { ...settings };
			showToast(`Module "${TYPE_ACTE_LABELS[key] || key}" ${d.enabled ? 'activé' : 'désactivé'}`);
		}
	}

	async function saveGlobalParams() {
		saving = true;
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'save_global', data: globalEdit })
		});
		saving = false;
		if (res.ok) showToast('Paramètres globaux enregistrés');
		else showToast('Erreur lors de la sauvegarde', 'error');
	}

	async function saveRoleSettings(role, data) {
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'save_role_settings', role, data })
		});
		if (res.ok) {
			settings[role] = { ...settings[role], ...data };
			showToast(`Paramètres ${role} enregistrés`);
		}
	}

	async function toggleLock(param) {
		const locked = settings.global.locked_params || [];
		const isLocked = locked.includes(param);
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: isLocked ? 'unlock_param' : 'lock_param', param })
		});
		if (res.ok) {
			if (isLocked) {
				settings.global.locked_params = locked.filter(p => p !== param);
			} else {
				settings.global.locked_params = [...locked, param];
			}
			settings = { ...settings };
			showToast(`Paramètre "${param}" ${isLocked ? 'déverrouillé' : 'verrouillé'}`);
		}
	}

	async function addUser() {
		addUserError = '';
		if (!newUser.prenom || !newUser.nom || !newUser.email) {
			addUserError = 'Tous les champs sont requis.';
			return;
		}
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'add_user', role: newUser.role, user: newUser })
		});
		if (res.ok) {
			await loadAll();
			showAddUser = false;
			newUser = { prenom: '', nom: '', email: '', role: 'agent' };
			showToast('Utilisateur ajouté');
		}
	}

	async function toggleUser(userId, role) {
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'toggle_user', userId, role })
		});
		if (res.ok) await loadAll();
	}

	function logout() {
		authRole.logout();
		goto('/agent/login');
	}

	$: lockedParams = settings.global?.locked_params || [];
	$: modules = settings.global?.modules || {};
</script>

<svelte:head>
	<title>Super Admin – CiviCI</title>
</svelte:head>

<!-- Toast -->
{#if toast}
	<div class="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2
		{toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-primary-500 text-white'}">
		{toast.type === 'error' ? '❌' : '✅'} {toast.msg}
	</div>
{/if}

<!-- Header -->
<header class="bg-gray-900 text-white sticky top-0 z-40 shadow-lg">
	<div class="max-w-7xl mx-auto px-4 sm:px-6">
		<div class="flex items-center justify-between h-14">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
					<span class="text-white font-syne font-bold text-sm">🔐</span>
				</div>
				<div>
					<span class="font-syne font-bold text-white">CiviCI</span>
					<span class="text-gray-400 text-xs ml-2">Super Admin</span>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<span class="text-xs bg-red-800 text-red-200 px-2.5 py-1 rounded-full font-medium">Super Admin</span>
				<a href="/" class="text-xs text-gray-400 hover:text-white transition-colors">Portail citoyen</a>
				<button on:click={logout} class="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
					</svg>
					Déconnexion
				</button>
			</div>
		</div>
	</div>
</header>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">

		{#if loading}
			<div class="flex items-center justify-center py-32 text-gray-400">
				<svg class="w-8 h-8 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
				</svg>
				Chargement...
			</div>
		{:else}

		<!-- Tabs -->
		<div class="flex gap-2 mb-8 overflow-x-auto pb-1">
			{#each TABS as tab}
				<button
					on:click={() => activeTab = tab.id}
					class="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all
						{activeTab === tab.id ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'}"
				>
					<span>{tab.icon}</span>{tab.label}
				</button>
			{/each}
		</div>

		<!-- ── TAB: VUE D'ENSEMBLE ─────────────────────────────── -->
		{#if activeTab === 'overview'}
			<div class="space-y-6">
				<h1 class="font-syne font-bold text-2xl text-gray-800">Vue d'ensemble système</h1>

				<!-- KPIs -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
					{#each [
						{ label: 'Total demandes', value: stats.total, icon: '📋', color: 'bg-blue-50 border-blue-100', text: 'text-blue-700' },
						{ label: 'En attente', value: stats.recues + stats.en_cours, icon: '⏳', color: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
						{ label: 'Traitées', value: stats.traitees, icon: '✅', color: 'bg-primary-50 border-primary-100', text: 'text-primary-700' },
						{ label: 'Escaladées', value: stats.escaladees, icon: '⚠️', color: 'bg-red-50 border-red-100', text: 'text-red-700' }
					] as kpi}
						<div class="bg-white rounded-2xl border {kpi.color} p-5">
							<div class="text-2xl mb-2">{kpi.icon}</div>
							<p class="font-syne font-bold text-3xl {kpi.text}">{kpi.value ?? 0}</p>
							<p class="text-xs text-gray-500 mt-1">{kpi.label}</p>
						</div>
					{/each}
				</div>

				<div class="grid sm:grid-cols-3 gap-4">
					<div class="bg-white rounded-2xl border border-gray-100 p-5">
						<p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Agents actifs</p>
						<p class="font-syne font-bold text-3xl text-gray-800">{stats.agents_actifs ?? 0}</p>
					</div>
					<div class="bg-white rounded-2xl border border-gray-100 p-5">
						<p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Modules actifs</p>
						<p class="font-syne font-bold text-3xl text-gray-800">{stats.modules_actifs ?? 0} / {Object.keys(modules).length}</p>
					</div>
					<div class="bg-white rounded-2xl border border-gray-100 p-5">
						<p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Params verrouillés</p>
						<p class="font-syne font-bold text-3xl text-gray-800">{lockedParams.length}</p>
					</div>
				</div>

				<!-- Répartition par service -->
				{#if Object.keys(par_type).length > 0}
				<div class="bg-white rounded-2xl border border-gray-100 p-6">
					<h2 class="font-syne font-semibold text-gray-700 mb-4">Demandes par service</h2>
					<div class="space-y-3">
						{#each Object.entries(par_type).sort((a,b) => b[1]-a[1]) as [type, count]}
							{@const total = stats.total || 1}
							<div class="flex items-center gap-3">
								<span class="text-lg w-8 text-center">{TYPE_ACTE_ICONS[type] || '📄'}</span>
								<span class="text-sm text-gray-700 w-48 truncate">{TYPE_ACTE_LABELS[type] || type}</span>
								<div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
									<div class="h-full bg-primary-500 rounded-full" style="width: {Math.round(count/total*100)}%"></div>
								</div>
								<span class="text-sm font-semibold text-gray-700 w-8 text-right">{count}</span>
							</div>
						{/each}
					</div>
				</div>
				{/if}
			</div>

		<!-- ── TAB: MODULES ────────────────────────────────────── -->
		{:else if activeTab === 'modules'}
			<div class="space-y-6">
				<div>
					<h1 class="font-syne font-bold text-2xl text-gray-800">Gestion des modules</h1>
					<p class="text-sm text-gray-500 mt-1">Activez ou désactivez les services proposés aux citoyens. Un module désactivé n'apparaît plus sur le portail.</p>
				</div>

				<div class="grid sm:grid-cols-2 gap-3">
					{#each Object.entries(modules) as [key, enabled]}
						<div class="bg-white rounded-xl border {enabled ? 'border-primary-200' : 'border-gray-200'} p-4 flex items-center gap-4">
							<span class="text-2xl">{TYPE_ACTE_ICONS[key] || '📄'}</span>
							<div class="flex-1">
								<p class="font-medium text-gray-800 text-sm">{TYPE_ACTE_LABELS[key] || key}</p>
								<p class="text-xs {enabled ? 'text-primary-600' : 'text-gray-400'}">{enabled ? 'Actif' : 'Désactivé'}</p>
							</div>
							<button
								on:click={() => toggleModule(key)}
								class="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0
									{enabled ? 'bg-primary-500' : 'bg-gray-300'}"
							>
								<span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300
									{enabled ? 'left-6' : 'left-0.5'}"></span>
							</button>
						</div>
					{/each}
				</div>

				<div class="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
					<span class="text-lg flex-shrink-0">⚠️</span>
					<p class="text-sm text-amber-800">Désactiver un module masque le service sur le portail citoyen mais ne supprime pas les demandes existantes de ce type.</p>
				</div>
			</div>

		<!-- ── TAB: UTILISATEURS ───────────────────────────────── -->
		{:else if activeTab === 'users'}
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<div>
						<h1 class="font-syne font-bold text-2xl text-gray-800">Gestion des utilisateurs</h1>
						<p class="text-sm text-gray-500 mt-1">Agents, superviseurs et maire de la mairie.</p>
					</div>
					<button on:click={() => { showAddUser = !showAddUser; addUserError = ''; }} class="btn-primary text-sm">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
						</svg>
						Nouvel utilisateur
					</button>
				</div>

				<!-- Formulaire ajout -->
				{#if showAddUser}
					<div class="bg-white rounded-2xl border border-gray-200 p-6">
						<h2 class="font-syne font-semibold text-gray-700 mb-4">Ajouter un utilisateur</h2>
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
					<h2 class="font-syne font-semibold text-gray-600 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
						<span class="w-2 h-2 bg-blue-400 rounded-full"></span> Agents ({users.agents?.length || 0})
					</h2>
					<div class="space-y-2">
						{#each users.agents || [] as agent}
							<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
								<div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center font-syne font-bold text-blue-700 text-sm flex-shrink-0">
									{agent.avatar}
								</div>
								<div class="flex-1">
									<p class="font-medium text-gray-800 text-sm">{agent.prenom} {agent.nom}</p>
									<p class="text-xs text-gray-400">{agent.email}</p>
								</div>
								<span class="text-xs px-2 py-0.5 rounded-full font-medium
									{agent.actif !== false ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}">
									{agent.actif !== false ? 'Actif' : 'Inactif'}
								</span>
								<button
									on:click={() => toggleUser(agent.id, 'agent')}
									class="text-xs px-3 py-1.5 rounded-lg border transition-all
										{agent.actif !== false ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-primary-200 text-primary-600 hover:bg-primary-50'}"
								>
									{agent.actif !== false ? 'Désactiver' : 'Réactiver'}
								</button>
							</div>
						{/each}
					</div>
				</div>

				<!-- Superviseurs -->
				<div>
					<h2 class="font-syne font-semibold text-gray-600 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
						<span class="w-2 h-2 bg-violet-400 rounded-full"></span> Superviseurs ({users.superviseurs?.length || 0})
					</h2>
					<div class="space-y-2">
						{#each users.superviseurs || [] as sup}
							<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
								<div class="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center font-syne font-bold text-violet-700 text-sm flex-shrink-0">
									{sup.avatar}
								</div>
								<div class="flex-1">
									<p class="font-medium text-gray-800 text-sm">{sup.prenom} {sup.nom}</p>
									<p class="text-xs text-gray-400">{sup.email}</p>
								</div>
								<span class="text-xs px-2 py-0.5 rounded-full font-medium
									{sup.actif !== false ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}">
									{sup.actif !== false ? 'Actif' : 'Inactif'}
								</span>
								<button
									on:click={() => toggleUser(sup.id, 'superviseur')}
									class="text-xs px-3 py-1.5 rounded-lg border transition-all
										{sup.actif !== false ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-primary-200 text-primary-600 hover:bg-primary-50'}"
								>
									{sup.actif !== false ? 'Désactiver' : 'Réactiver'}
								</button>
							</div>
						{/each}
					</div>
				</div>

				<!-- Maire -->
				{#if users.maire}
				<div>
					<h2 class="font-syne font-semibold text-gray-600 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
						<span class="w-2 h-2 bg-primary-400 rounded-full"></span> Maire
					</h2>
					<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
						<div class="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center font-syne font-bold text-primary-700 text-sm flex-shrink-0">
							{users.maire.avatar}
						</div>
						<div class="flex-1">
							<p class="font-medium text-gray-800 text-sm">{users.maire.prenom} {users.maire.nom}</p>
							<p class="text-xs text-gray-400">{users.maire.email}</p>
						</div>
						<span class="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Maire</span>
					</div>
				</div>
				{/if}
			</div>

		<!-- ── TAB: PARAMÈTRES ─────────────────────────────────── -->
		{:else if activeTab === 'params'}
			<div class="space-y-6">
				<h1 class="font-syne font-bold text-2xl text-gray-800">Paramètres système</h1>

				<!-- Paramètres globaux -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6">
					<h2 class="font-syne font-semibold text-gray-700 mb-5 flex items-center gap-2">
						🌐 Paramètres globaux
					</h2>
					<div class="grid sm:grid-cols-2 gap-5">
						<div>
							<label class="label text-xs flex items-center gap-2">
								Frais de copie (FCFA)
								{#if lockedParams.includes('frais_copie')}<span class="text-xs text-red-500">🔒 verrouillé</span>{/if}
							</label>
							<input type="number" bind:value={globalEdit.frais_copie}
								disabled={lockedParams.includes('frais_copie')}
								class="input-field text-sm {lockedParams.includes('frais_copie') ? 'bg-gray-50 opacity-60' : ''}"/>
						</div>
						<div>
							<label class="label text-xs flex items-center gap-2">
								Frais copie intégrale (FCFA)
								{#if lockedParams.includes('frais_copie_integrale')}<span class="text-xs text-red-500">🔒 verrouillé</span>{/if}
							</label>
							<input type="number" bind:value={globalEdit.frais_copie_integrale}
								disabled={lockedParams.includes('frais_copie_integrale')}
								class="input-field text-sm {lockedParams.includes('frais_copie_integrale') ? 'bg-gray-50 opacity-60' : ''}"/>
						</div>
						<div>
							<label class="label text-xs flex items-center gap-2">
								SLA par défaut (heures)
								{#if lockedParams.includes('sla_heures_defaut')}<span class="text-xs text-red-500">🔒 verrouillé</span>{/if}
							</label>
							<input type="number" bind:value={globalEdit.sla_heures_defaut}
								disabled={lockedParams.includes('sla_heures_defaut')}
								class="input-field text-sm {lockedParams.includes('sla_heures_defaut') ? 'bg-gray-50 opacity-60' : ''}"/>
						</div>
						<div>
							<label class="label text-xs">Délai déclaration naissance (jours)</label>
							<input type="number" bind:value={globalEdit.delai_declaration_naissance_jours} class="input-field text-sm"/>
						</div>
						<div>
							<label class="label text-xs">Délai déclaration décès (jours)</label>
							<input type="number" bind:value={globalEdit.delai_declaration_deces_jours} class="input-field text-sm"/>
						</div>
					</div>
					<button on:click={saveGlobalParams} disabled={saving} class="btn-primary text-sm mt-5">
						{saving ? 'Enregistrement...' : 'Enregistrer les paramètres globaux'}
					</button>
				</div>

				<!-- Paramètres agents -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6">
					<h2 class="font-syne font-semibold text-gray-700 mb-5 flex items-center gap-2">
						👩‍💼 Paramètres agents
					</h2>
					<div class="space-y-4">
						<div>
							<label class="label text-xs flex items-center gap-2">
								SLA alerte (heures)
								{#if lockedParams.includes('sla_heures')}<span class="text-xs text-red-500">🔒 verrouillé — non modifiable par les agents</span>{/if}
							</label>
							<div class="flex items-center gap-3">
								{#each [24, 48, 72] as h}
									<button
										on:click={() => !lockedParams.includes('sla_heures') && saveRoleSettings('agent', { sla_heures: h })}
										class="px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all
											{settings.agent?.sla_heures === h ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}
											{lockedParams.includes('sla_heures') ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-300'}"
									>{h}h</button>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<!-- Paramètres superviseur -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6">
					<h2 class="font-syne font-semibold text-gray-700 mb-5 flex items-center gap-2">
						👨‍💻 Paramètres superviseur
					</h2>
					<div>
						<label class="label text-xs flex items-center gap-2">
							Seuil alerte escalades
							{#if lockedParams.includes('seuil_escalades_alerte')}<span class="text-xs text-red-500">🔒 verrouillé</span>{/if}
						</label>
						<div class="flex items-center gap-3">
							{#each [1, 3, 5, 10] as s}
								<button
									on:click={() => !lockedParams.includes('seuil_escalades_alerte') && saveRoleSettings('superviseur', { seuil_escalades_alerte: s })}
									class="px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all
										{settings.superviseur?.seuil_escalades_alerte === s ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600'}
										{lockedParams.includes('seuil_escalades_alerte') ? 'opacity-50 cursor-not-allowed' : 'hover:border-violet-300'}"
								>{s}</button>
							{/each}
						</div>
					</div>
				</div>
			</div>

		<!-- ── TAB: VERROUILLAGES ──────────────────────────────── -->
		{:else if activeTab === 'locks'}
			<div class="space-y-6">
				<div>
					<h1 class="font-syne font-bold text-2xl text-gray-800">Verrouillage des paramètres</h1>
					<p class="text-sm text-gray-500 mt-1">Un paramètre verrouillé ne peut plus être modifié par les agents, superviseurs ou le maire. Seul le Super Admin peut le changer.</p>
				</div>

				<div class="space-y-3">
					{#each LOCKABLE_PARAMS as param}
						{@const isLocked = lockedParams.includes(param.key)}
						<div class="bg-white rounded-xl border {isLocked ? 'border-red-200 bg-red-50/30' : 'border-gray-100'} p-4 flex items-center gap-4">
							<div class="text-2xl flex-shrink-0">{isLocked ? '🔒' : '🔓'}</div>
							<div class="flex-1">
								<p class="font-medium text-sm {isLocked ? 'text-red-800' : 'text-gray-800'}">{param.label}</p>
								<p class="text-xs text-gray-400">
									Rôle concerné : <span class="font-medium">{param.role}</span>
									· Clé : <span class="font-mono">{param.key}</span>
								</p>
							</div>
							<div class="flex items-center gap-3">
								{#if isLocked}
									<span class="text-xs bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded-full">Verrouillé</span>
								{:else}
									<span class="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">Libre</span>
								{/if}
								<button
									on:click={() => toggleLock(param.key)}
									class="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all
										{isLocked
											? 'border-primary-200 text-primary-600 hover:bg-primary-50'
											: 'border-red-200 text-red-600 hover:bg-red-50'}"
								>
									{isLocked ? '🔓 Déverrouiller' : '🔒 Verrouiller'}
								</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
					<span class="text-lg flex-shrink-0">ℹ️</span>
					<div class="text-sm text-blue-800">
						<p class="font-semibold mb-1">Comment ça fonctionne ?</p>
						<p>Les paramètres verrouillés apparaissent en lecture seule dans les écrans de paramètres des autres profils. Seul le Super Admin peut les modifier depuis cet écran.</p>
					</div>
				</div>
			</div>
		{/if}

		{/if}
	</div>
</div>
