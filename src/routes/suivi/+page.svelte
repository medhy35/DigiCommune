<script>
	import { goto } from '$app/navigation';

	let numero = '';
	let nom = '';
	let searching = false;
	let searchError = '';

	async function handleSearch() {
		if (!numero.trim() || !nom.trim()) return;
		searching = true;
		searchError = '';

		const res = await fetch(`/api/demandes/${numero.trim().toUpperCase()}`);
		if (res.ok) {
			const demande = await res.json();
			const nomSaisi = nom.trim().toLowerCase();
			const nomDemande = demande.demandeur.nom.toLowerCase();
			if (nomSaisi === nomDemande) {
				goto(`/suivi/${demande.id}`);
			} else {
				searchError = 'Aucune demande trouvée avec ces informations. Vérifiez votre numéro et votre nom de famille.';
			}
		} else {
			searchError = 'Aucune demande trouvée avec ces informations. Vérifiez votre numéro et votre nom de famille.';
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
		<p class="text-gray-500">Saisissez votre numéro de dossier et votre nom de famille pour accéder à votre suivi.</p>
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
					autocomplete="off"
				/>
			</div>

			<div>
				<label class="label" for="nom">Nom de famille du demandeur</label>
				<input
					id="nom"
					type="text"
					bind:value={nom}
					placeholder="Votre nom de famille"
					class="input-field {searchError ? 'border-red-400' : ''}"
					autocomplete="family-name"
				/>
			</div>

			{#if searchError}
				<div class="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
					<svg class="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
					</svg>
					{searchError}
				</div>
			{/if}

			<button
				type="submit"
				class="btn-primary w-full justify-center py-3"
				disabled={searching || !numero.trim() || !nom.trim()}
			>
				{#if searching}
					<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
					</svg>
					Vérification en cours...
				{:else}
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
					Accéder à mon dossier
				{/if}
			</button>
		</form>
	</div>

	<div class="mt-6 text-center space-y-2">
		<p class="text-sm text-gray-400">
			Vous retrouvez votre numéro de dossier dans l'attestation de dépôt ou le SMS/email de confirmation.
		</p>
		<p class="text-sm text-gray-400">
			Vous n'avez pas encore fait de demande ?
			<a href="/demande" class="text-primary-600 hover:underline font-medium">Faire une demande</a>
		</p>
	</div>
</main>
