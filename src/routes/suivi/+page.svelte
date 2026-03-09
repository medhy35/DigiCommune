<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let numero = '';
	let searching = false;
	let searchError = '';

	async function handleSearch() {
		if (!numero.trim()) return;
		searching = true;
		searchError = '';
		const res = await fetch(`/api/demandes/${numero.trim().toUpperCase()}`);
		if (res.ok) {
			goto(`/suivi/${numero.trim().toUpperCase()}`);
		} else {
			searchError = 'Aucune demande trouvée avec ce numéro. Vérifiez le format CI-2025-XXXX.';
		}
		searching = false;
	}
</script>

<svelte:head>
	<title>Suivre ma demande – CiviCI</title>
</svelte:head>

<header class="bg-white border-b border-gray-100 shadow-sm">
	<div class="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
		<a href="/" class="text-gray-400 hover:text-gray-600">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
			</svg>
		</a>
		<div class="flex items-center gap-2">
			<div class="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
				<span class="text-white font-syne font-bold text-xs">C</span>
			</div>
			<span class="font-syne font-semibold text-primary-600">CiviCI</span>
		</div>
		<span class="text-gray-300">|</span>
		<span class="text-gray-600 text-sm">Suivi de demande</span>
	</div>
</header>

<main class="max-w-2xl mx-auto px-4 py-12">
	<div class="text-center mb-8">
		<div class="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">📬</div>
		<h1 class="font-syne font-bold text-2xl text-gray-800 mb-2">Suivre ma demande</h1>
		<p class="text-gray-500">Saisissez votre numéro de dossier pour suivre l'avancement de votre demande.</p>
	</div>

	<div class="card">
		<form on:submit|preventDefault={handleSearch} class="space-y-4">
			<div>
				<label class="label" for="numero">Numéro de dossier</label>
				<input
					id="numero"
					type="text"
					bind:value={numero}
					placeholder="CI-2025-XXXX"
					class="input-field text-center font-mono text-lg uppercase {searchError ? 'border-red-400' : ''}"
					maxlength="16"
				/>
				{#if searchError}
					<p class="text-sm text-red-600 mt-2">{searchError}</p>
				{/if}
			</div>
			<button type="submit" class="btn-primary w-full justify-center py-3" disabled={searching}>
				{#if searching}
					<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
					</svg>
					Recherche en cours...
				{:else}
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
					Rechercher
				{/if}
			</button>
		</form>
	</div>

	<p class="text-center text-sm text-gray-400 mt-6">
		Vous n'avez pas encore fait de demande ?
		<a href="/demande" class="text-primary-600 hover:underline font-medium">Faire une demande</a>
	</p>
</main>
