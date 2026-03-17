<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let result = null;
	let loading = true;

	$: code = $page.params.code;

	onMount(async () => {
		const res = await fetch(`/api/verifier/${code}`);
		if (res.ok) result = await res.json();
		else result = { valide: false };
		loading = false;
	});

	function formatDate(iso) {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Vérification document — {code}</title>
</svelte:head>

<main class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
	<div class="w-full max-w-md">
		<!-- Logo / En-tête -->
		<div class="text-center mb-8">
			<p class="text-xs uppercase tracking-widest text-gray-400 font-semibold">Vérification de document</p>
			<h1 class="font-mono text-sm text-gray-500 mt-1">{code}</h1>
		</div>

		{#if loading}
			<div class="card flex flex-col items-center py-12 gap-4 text-gray-400">
				<svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
				</svg>
				<p class="text-sm">Vérification en cours…</p>
			</div>

		{:else if result?.valide}
			<!-- Document authentique -->
			<div class="bg-green-50 border-2 border-green-400 rounded-2xl p-6 text-center mb-4">
				<div class="flex items-center justify-center w-14 h-14 bg-green-100 rounded-full mx-auto mb-3">
					<svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
					</svg>
				</div>
				<h2 class="font-syne font-bold text-xl text-green-800 mb-1">Document authentique</h2>
				<p class="text-sm text-green-700">Ce document a été émis et signé numériquement par la mairie.</p>
			</div>

			<div class="card space-y-3 mb-4">
				<h3 class="font-syne font-semibold text-gray-700 text-sm">Informations du document</h3>
				<dl class="space-y-2 text-sm">
					<div class="flex justify-between py-1.5 border-b border-gray-50">
						<dt class="text-gray-500">Type de document</dt>
						<dd class="font-medium text-gray-800">{result.type_label}</dd>
					</div>
					{#if result.type_acte}
						<div class="flex justify-between py-1.5 border-b border-gray-50">
							<dt class="text-gray-500">Type d'acte</dt>
							<dd class="font-medium text-gray-800">{result.type_acte}</dd>
						</div>
					{/if}
					<div class="flex justify-between py-1.5 border-b border-gray-50">
						<dt class="text-gray-500">N° de dossier</dt>
						<dd class="font-mono font-semibold text-primary-600">{result.demande_id}</dd>
					</div>
					<div class="flex justify-between py-1.5 border-b border-gray-50">
						<dt class="text-gray-500">Demandeur</dt>
						<dd class="font-medium text-gray-800">{result.demandeur}</dd>
					</div>
					{#if result.numero_acte}
						<div class="flex justify-between py-1.5 border-b border-gray-50">
							<dt class="text-gray-500">N° de l'acte</dt>
							<dd class="font-medium text-gray-800">{result.numero_acte}</dd>
						</div>
					{/if}
					{#if result.officier}
						<div class="flex justify-between py-1.5 border-b border-gray-50">
							<dt class="text-gray-500">Signé par</dt>
							<dd class="font-medium text-gray-800">{result.officier}</dd>
						</div>
					{/if}
					{#if result.montant}
						<div class="flex justify-between py-1.5 border-b border-gray-50">
							<dt class="text-gray-500">Montant</dt>
							<dd class="font-medium text-gray-800">{result.montant.toLocaleString('fr-FR')} FCFA</dd>
						</div>
					{/if}
					<div class="flex justify-between py-1.5">
						<dt class="text-gray-500">Émis le</dt>
						<dd class="font-medium text-gray-800">{formatDate(result.created_at)}</dd>
					</div>
				</dl>
			</div>

			<p class="text-xs text-center text-gray-400">
				Ce document est certifié authentique par le système CiviCI de la mairie.
			</p>

		{:else}
			<!-- Document invalide -->
			<div class="bg-red-50 border-2 border-red-300 rounded-2xl p-6 text-center">
				<div class="flex items-center justify-center w-14 h-14 bg-red-100 rounded-full mx-auto mb-3">
					<svg class="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</div>
				<h2 class="font-syne font-bold text-xl text-red-800 mb-1">Document non reconnu</h2>
				<p class="text-sm text-red-700 mb-4">
					Ce code de vérification est invalide ou le document est introuvable dans notre système.
					Il peut s'agir d'un document falsifié.
				</p>
				<p class="text-xs text-red-500">
					En cas de doute, contactez directement la mairie.
				</p>
			</div>
		{/if}

		<div class="text-center mt-6">
			<a href="/" class="text-xs text-gray-400 hover:text-primary-600 transition-colors">← Retour à l'accueil</a>
		</div>
	</div>
</main>
