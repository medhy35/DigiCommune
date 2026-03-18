<script>
	import { goto } from '$app/navigation';
	import { authUser, authRole } from '$lib/stores/auth.js';
	import { commune } from '$lib/stores/commune.js';
	import CommuneLogo from '$lib/components/CommuneLogo.svelte';
	import { onMount } from 'svelte';

	const ROLE_ROUTES = {
		agent:       '/agent',
		superviseur: '/superviseur',
		maire:       '/maire',
		superadmin:  '/superadmin'
	};

	onMount(() => {
		if ($authRole) goto(ROLE_ROUTES[$authRole] || '/agent');
	});

	let email    = '';
	let password = '';
	let loginError = '';
	let loading  = false;

	async function handleLogin() {
		loginError = '';
		loading = true;
		try {
			const user = await authUser.login(email, password);
			goto(ROLE_ROUTES[user.role] || '/agent');
		} catch (e) {
			loginError = e.message || 'Identifiants incorrects.';
		} finally {
			loading = false;
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Enter') handleLogin();
	}
</script>

<svelte:head>
	<title>Connexion — {$commune?.nom_app || 'DigiCommune'}</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
	<header class="bg-white border-b border-gray-100 shadow-sm">
		<div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
			<a href="/" class="flex items-center gap-2">
				<CommuneLogo commune={$commune} size="w-9 h-9" rounded="rounded-xl" shadow="shadow-sm" />
				<div>
					<span class="font-syne font-bold text-primary-600">{$commune?.nom_app || 'DigiCommune'}</span>
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

	<main class="flex-1 flex items-center justify-center px-4 py-12">
		<div class="w-full max-w-sm">
			<div class="text-center mb-8">
				<div class="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
					<svg class="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
					</svg>
				</div>
				<h1 class="font-syne font-bold text-2xl text-gray-800 mb-1">Connexion</h1>
				<p class="text-sm text-gray-500">{$commune?.nom || 'Back-office municipal'}</p>
			</div>

			<div class="bg-white rounded-2xl shadow-card p-8">
				{#if loginError}
					<div class="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-sm text-red-700">
						<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						{loginError}
					</div>
				{/if}

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1" for="email">Adresse email</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							on:keydown={handleKeydown}
							class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
							placeholder="vous@mairie.ci"
							autocomplete="email"
							disabled={loading}
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1" for="password">Mot de passe</label>
						<input
							id="password"
							type="password"
							bind:value={password}
							on:keydown={handleKeydown}
							class="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
							placeholder="••••••••"
							autocomplete="current-password"
							disabled={loading}
						/>
					</div>

					<button
						on:click={handleLogin}
						disabled={loading || !email || !password}
						class="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
					>
						{#if loading}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
							</svg>
							Connexion…
						{:else}
							Se connecter
						{/if}
					</button>
				</div>
			</div>

			<p class="text-center text-xs text-gray-400 mt-6">
				Accès réservé aux agents municipaux autorisés.
			</p>
		</div>
	</main>

	<footer class="py-4 text-center text-xs text-gray-400">
		{$commune?.nom || 'DigiCommune'} — Plateforme de gestion municipale
	</footer>
</div>
