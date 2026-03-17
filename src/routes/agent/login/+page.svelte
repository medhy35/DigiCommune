<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authRole, authUser } from '$lib/stores/auth.js';
	import { commune } from '$lib/stores/commune.js';
	import CommuneLogo from '$lib/components/CommuneLogo.svelte';

	const ROLE_ROUTES = {
		agent:      '/agent',
		superviseur:'/superviseur',
		maire:      '/maire',
		superadmin: '/superadmin'
	};

	// Catalogue des rôles — métadonnées statiques uniquement (pas de noms ni d'IDs)
	const ROLE_META = {
		agent: {
			label: 'Agent',
			desc:  'Traiter les demandes des citoyens, mettre à jour les statuts et générer les actes.',
			icon:  '👩‍💼',
			color: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50',
			badge: 'bg-blue-100 text-blue-700'
		},
		superviseur: {
			label: 'Superviseur',
			desc:  'Superviser les agents, traiter les escalades et réassigner les demandes.',
			icon:  '👨‍💻',
			color: 'border-violet-200 hover:border-violet-400 hover:bg-violet-50',
			badge: 'bg-violet-100 text-violet-700'
		},
		maire: {
			label: 'Maire',
			desc:  'Vue synthétique des statistiques et décisions sur les cas critiques.',
			icon:  '🏛️',
			color: 'border-primary-200 hover:border-primary-400 hover:bg-primary-50',
			badge: 'bg-primary-100 text-primary-700'
		},
		superadmin: {
			label: 'Super Admin',
			desc:  'Configuration complète de l\'application, gestion des modules, utilisateurs et paramètres système.',
			icon:  '🔐',
			color: 'border-red-200 hover:border-red-400 hover:bg-red-50',
			badge: 'bg-red-100 text-red-700'
		}
	};

	// Users chargés depuis /api/users (source : utilisateurs.json → futur : Postgres)
	let usersByRole = {};
	let loadingUsers = true;

	// Sélecteur d'agent (si plusieurs agents disponibles)
	let pendingRole  = null; // rôle en attente de sélection d'utilisateur
	let selectingUser = false;

	onMount(async () => {
		if ($authRole) goto(ROLE_ROUTES[$authRole] || '/agent');
		try {
			const res = await fetch('/api/users');
			if (res.ok) {
				const users = await res.json();
				usersByRole = users.reduce((acc, u) => {
					if (!acc[u.role]) acc[u.role] = [];
					acc[u.role].push(u);
					return acc;
				}, {});
			}
		} catch {}
		loadingUsers = false;
	});

	function handleRoleClick(role) {
		const users = usersByRole[role] || [];
		if (users.length === 1) {
			// Un seul utilisateur pour ce rôle → connexion directe
			loginAs(role, users[0].id);
		} else if (users.length > 1) {
			// Plusieurs utilisateurs → afficher le sélecteur
			pendingRole   = role;
			selectingUser = true;
		} else {
			// Aucun user configuré (ne devrait pas arriver) → login sans userId
			loginAs(role, null);
		}
	}

	function loginAs(role, userId) {
		authUser.login(role, userId);
		goto(ROLE_ROUTES[role] || '/agent');
	}

	function cancelSelect() {
		pendingRole   = null;
		selectingUser = false;
	}
</script>

<svelte:head>
	<title>Connexion Back-office – CiviCI</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
	<!-- Header -->
	<header class="bg-white border-b border-gray-100 shadow-sm">
		<div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
			<a href="/" class="flex items-center gap-2">
				<CommuneLogo commune={$commune} size="w-9 h-9" rounded="rounded-xl" shadow="shadow-sm" />
				<div>
					<span class="font-syne font-bold text-primary-600">{$commune?.nom_app || 'CiviCI'}</span>
					<p class="text-xs text-gray-400 leading-tight">Espace Back-office</p>
				</div>
			</a>
			<a href="/" class="text-sm text-gray-500 hover:text-primary-600 transition-colors flex items-center gap-1">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
				</svg>
				Portail citoyen
			</a>
		</div>
	</header>

	<!-- Main -->
	<main class="flex-1 flex items-center justify-center px-4 py-12">
		<div class="w-full max-w-3xl">

			{#if selectingUser && pendingRole}
				<!-- Sélecteur d'utilisateur -->
				<div class="text-center mb-8">
					<button on:click={cancelSelect} class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
						</svg>
						Retour
					</button>
					<h1 class="font-syne font-bold text-2xl text-gray-800 mb-1">
						Choisir un compte {ROLE_META[pendingRole].label}
					</h1>
					<p class="text-gray-500 text-sm">Plusieurs agents sont configurés — sélectionnez le vôtre.</p>
				</div>

				<div class="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
					{#each (usersByRole[pendingRole] || []).filter(u => u.actif) as user}
						<button
							on:click={() => loginAs(pendingRole, user.id)}
							class="bg-white rounded-2xl border-2 {ROLE_META[pendingRole].color} p-5 text-left transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 group"
						>
							<div class="flex items-center gap-3 mb-2">
								<div class="w-10 h-10 rounded-full {ROLE_META[pendingRole].badge} flex items-center justify-center font-bold text-sm">
									{user.avatar || (user.prenom[0] + user.nom[0])}
								</div>
								<div>
									<p class="font-semibold text-gray-800">{user.prenom} {user.nom}</p>
									<p class="text-xs text-gray-400">{user.email}</p>
								</div>
							</div>
							<div class="mt-3 flex items-center gap-1 text-sm font-semibold text-gray-600 group-hover:text-primary-600 transition-colors">
								Se connecter
								<svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
								</svg>
							</div>
						</button>
					{/each}
				</div>

			{:else}
				<!-- Grille des rôles -->
				<div class="text-center mb-10">
					<h1 class="font-syne font-bold text-3xl text-gray-800 mb-2">Accès Back-office</h1>
					<p class="text-gray-500 max-w-md mx-auto">
						Connexion simulée pour le POC. Choisissez un profil pour accéder au tableau de bord correspondant.
					</p>
					<div class="mt-3 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 text-xs text-amber-700">
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						Mode démonstration — Aucun mot de passe requis
					</div>
				</div>

				<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{#each Object.entries(ROLE_META) as [roleId, meta]}
						{@const users = usersByRole[roleId] || []}
						<button
							on:click={() => handleRoleClick(roleId)}
							disabled={loadingUsers}
							class="bg-white rounded-2xl border-2 {meta.color} p-6 text-left transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 group disabled:opacity-60 disabled:pointer-events-none"
						>
							<div class="text-4xl mb-3">{meta.icon}</div>
							<div class="flex items-center gap-2 mb-2">
								<span class="font-syne font-bold text-lg text-gray-800">{meta.label}</span>
								<span class="text-xs px-2 py-0.5 rounded-full {meta.badge} font-medium">{meta.label}</span>
							</div>
							<p class="text-xs text-gray-500 leading-relaxed mb-3">{meta.desc}</p>
							{#if !loadingUsers && users.length > 0}
								<p class="text-xs text-gray-400 italic">
									{users.length === 1
										? `${users[0].prenom} ${users[0].nom}`
										: `${users.length} comptes disponibles`}
								</p>
							{/if}
							<div class="mt-4 flex items-center gap-1 text-sm font-semibold text-gray-600 group-hover:text-primary-600 transition-colors">
								Se connecter
								<svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
								</svg>
							</div>
						</button>
					{/each}
				</div>
			{/if}

		</div>
	</main>

	<footer class="py-4 text-center text-xs text-gray-400">
		CiviCI — Portail de gestion municipal — Côte d'Ivoire
	</footer>
</div>
