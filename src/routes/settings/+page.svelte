<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authRole, ROLE_LABELS, ROLE_COLORS } from '$lib/stores/auth.js';
	import { toast } from '$lib/stores/toast.js';

	let role = null;
	let profil = null;
	let settings = null;
	let loading = true;
	let saving = false;

	// Local copies for binding
	let sla_heures = 48;
	let seuil_escalades_alerte = 3;
	let periode_dashboard = 'mois';
	let notif = {};

	onMount(async () => {
		role = $authRole;
		if (!role) { goto('/agent/login'); return; }

		const res = await fetch(`/api/settings?role=${role}`);
		const data = await res.json();
		settings = data.settings;
		profil = data.profil;

		// Init local bindings
		sla_heures = settings?.sla_heures ?? 48;
		seuil_escalades_alerte = settings?.seuil_escalades_alerte ?? 3;
		periode_dashboard = settings?.periode_dashboard ?? 'mois';
		notif = { ...(settings?.notifications || {}) };

		loading = false;
	});

	async function save() {
		saving = true;
		const newSettings = { ...settings, notifications: notif };
		if (role === 'agent') newSettings.sla_heures = sla_heures;
		if (role === 'superviseur') newSettings.seuil_escalades_alerte = seuil_escalades_alerte;
		if (role === 'maire') newSettings.periode_dashboard = periode_dashboard;

		const res = await fetch('/api/settings', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role, settings: newSettings })
		});
		if (res.ok) {
			settings = newSettings;
			toast('Paramètres enregistrés');
		} else {
			toast('Erreur lors de la sauvegarde', 'error');
		}
		saving = false;
	}
</script>

<svelte:head>
	<title>Paramètres – CiviCI</title>
</svelte:head>

<main class="max-w-2xl mx-auto px-4 sm:px-6 py-8">
	<div class="mb-6">
		<h1 class="font-syne font-bold text-2xl text-gray-800">Paramètres</h1>
		<p class="text-gray-500 text-sm mt-1">Gérez votre profil et vos préférences.</p>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-16 text-gray-400">
			<svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
			</svg>
		</div>
	{:else}
	<div class="space-y-5">

		<!-- Profil -->
		<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
			<h2 class="font-syne font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">Profil</h2>
			<div class="flex items-center gap-4">
				<div class="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center">
					<span class="font-syne font-bold text-primary-700 text-xl">{profil?.avatar || '?'}</span>
				</div>
				<div>
					<p class="font-semibold text-gray-800 text-lg">{profil?.prenom} {profil?.nom}</p>
					<p class="text-sm text-gray-500">{profil?.email}</p>
					<span class="inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full font-medium {ROLE_COLORS[role] || 'bg-gray-100 text-gray-600'}">
						{ROLE_LABELS[role] || role}
					</span>
				</div>
			</div>
		</div>

		<!-- Notifications -->
		<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
			<h2 class="font-syne font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">Notifications</h2>
			<div class="space-y-3">
				{#if role === 'agent'}
					{#each [
						{ key: 'nouvelle_demande', label: 'Nouvelle demande assignée', desc: 'Recevoir une notification à chaque nouvelle demande' },
						{ key: 'escalade_resolue', label: 'Escalade résolue', desc: 'Notifié quand le superviseur traite mon escalade' },
						{ key: 'reassignation', label: 'Réassignation de dossier', desc: 'Notifié si un dossier m\'est réassigné' }
					] as n}
						<label class="flex items-start gap-3 cursor-pointer group">
							<input type="checkbox" bind:checked={notif[n.key]} class="mt-0.5 w-4 h-4 accent-primary-600 cursor-pointer" />
							<div>
								<p class="text-sm font-medium text-gray-700 group-hover:text-primary-600">{n.label}</p>
								<p class="text-xs text-gray-400">{n.desc}</p>
							</div>
						</label>
					{/each}
				{:else if role === 'superviseur'}
					<label class="flex items-start gap-3 cursor-pointer group">
						<input type="checkbox" bind:checked={notif['nouvelle_escalade']} class="mt-0.5 w-4 h-4 accent-primary-600 cursor-pointer" />
						<div>
							<p class="text-sm font-medium text-gray-700 group-hover:text-primary-600">Nouvelle escalade</p>
							<p class="text-xs text-gray-400">Notifié immédiatement à chaque escalade agent</p>
						</div>
					</label>
				{:else if role === 'maire'}
					<label class="flex items-start gap-3 cursor-pointer group">
						<input type="checkbox" bind:checked={notif['cas_critique']} class="mt-0.5 w-4 h-4 accent-primary-600 cursor-pointer" />
						<div>
							<p class="text-sm font-medium text-gray-700 group-hover:text-primary-600">Cas critique</p>
							<p class="text-xs text-gray-400">Notifié quand un dossier est escaladé au niveau Maire</p>
						</div>
					</label>
				{/if}
			</div>
		</div>

		<!-- Paramètres spécifiques au rôle -->
		{#if role === 'agent'}
		<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
			<h2 class="font-syne font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">Alertes SLA</h2>
			<label class="block">
				<span class="text-sm font-medium text-gray-700">Délai d'alerte (heures)</span>
				<p class="text-xs text-gray-400 mb-2">Un badge d'alerte apparaît sur les demandes sans action passé ce délai.</p>
				<select bind:value={sla_heures} class="input-field text-sm w-40">
					<option value={24}>24 heures</option>
					<option value={48}>48 heures</option>
					<option value={72}>72 heures</option>
				</select>
			</label>
		</div>
		{:else if role === 'superviseur'}
		<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
			<h2 class="font-syne font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">Seuil d'alerte escalades</h2>
			<label class="block">
				<span class="text-sm font-medium text-gray-700">Nombre d'escalades déclenchant l'alerte</span>
				<p class="text-xs text-gray-400 mb-2">Affiche un indicateur visuel rouge sur le tableau de bord quand ce seuil est atteint.</p>
				<select bind:value={seuil_escalades_alerte} class="input-field text-sm w-40">
					<option value={1}>1 escalade</option>
					<option value={3}>3 escalades</option>
					<option value={5}>5 escalades</option>
					<option value={10}>10 escalades</option>
				</select>
			</label>
		</div>
		{:else if role === 'maire'}
		<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
			<h2 class="font-syne font-semibold text-gray-700 text-sm uppercase tracking-wide mb-4">Période du tableau de bord</h2>
			<label class="block">
				<span class="text-sm font-medium text-gray-700">Période d'analyse par défaut</span>
				<p class="text-xs text-gray-400 mb-2">Définit la plage temporelle affichée sur la vue synthétique.</p>
				<select bind:value={periode_dashboard} class="input-field text-sm w-48">
					<option value="semaine">Cette semaine</option>
					<option value="mois">Ce mois</option>
					<option value="trimestre">Ce trimestre</option>
				</select>
			</label>
		</div>
		{/if}

		<!-- Save button -->
		<div class="flex justify-end">
			<button
				on:click={save}
				class="btn-primary px-6"
				disabled={saving}
			>
				{#if saving}
					<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
					</svg>
				{/if}
				Enregistrer les paramètres
			</button>
		</div>
	</div>
	{/if}
</main>
