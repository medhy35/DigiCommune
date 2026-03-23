<script>
	import { page } from '$app/stores';
	import { commune } from '$lib/stores/commune.js';
</script>

<svelte:head>
	<title>Erreur {$page.status} – {$commune?.nom_app || 'DigiCommune'}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
	<div class="text-center max-w-md">

		{#if $page.status === 404}
			<div class="text-8xl mb-6">🗺️</div>
			<h1 class="font-syne font-bold text-3xl text-gray-800 mb-3">Page introuvable</h1>
			<p class="text-gray-500 mb-8">
				La page que vous cherchez n'existe pas ou a été déplacée.
			</p>
		{:else if $page.status === 403}
			<div class="text-8xl mb-6">🔒</div>
			<h1 class="font-syne font-bold text-3xl text-gray-800 mb-3">Accès refusé</h1>
			<p class="text-gray-500 mb-8">
				Vous n'avez pas les droits nécessaires pour accéder à cette page.
			</p>
		{:else}
			<div class="text-8xl mb-6">⚠️</div>
			<h1 class="font-syne font-bold text-3xl text-gray-800 mb-3">Une erreur est survenue</h1>
			<p class="text-gray-500 mb-8">
				{$page.error?.message || 'Erreur inattendue. Veuillez réessayer.'}
			</p>
		{/if}

		<div class="inline-flex items-center gap-2 mb-8 px-3 py-1.5 bg-gray-100 rounded-full">
			<span class="text-xs font-mono text-gray-400">Code erreur : {$page.status}</span>
		</div>

		<div class="flex flex-col sm:flex-row gap-3 justify-center">
			<a href="/" class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-all">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
				</svg>
				Retour à l'accueil
			</a>
			<a href="/suivi" class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all">
				📬 Suivre mon dossier
			</a>
		</div>

		{#if $commune}
			<p class="mt-10 text-xs text-gray-400">
				{$commune.nom_app} · {$commune.nom}
			</p>
		{/if}
	</div>
</div>
