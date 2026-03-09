<script>
	import { formatDateTime } from '$lib/utils/helpers.js';

	export let historique = [];
	export let statut = '';

	const TIMELINE_STEPS = [
		{ key: 'recue', label: 'Demande reçue', icon: '📋' },
		{ key: 'en_cours', label: 'En cours de traitement', icon: '⚙️' },
		{ key: 'traitee', label: 'Traitée', icon: '✅' },
		{ key: 'disponible', label: 'Disponible', icon: '🎉' }
	];

	const STEP_ORDER = ['recue', 'en_cours', 'traitee', 'disponible'];
	$: currentIndex = statut === 'rejetee' ? -1 : STEP_ORDER.indexOf(statut);

	function getStepEntry(stepKey) {
		return historique.filter(h => h.statut === stepKey).pop();
	}
</script>

{#if statut === 'rejetee'}
	<div class="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
		<span class="text-2xl">❌</span>
		<div>
			<p class="font-semibold text-red-700">Demande rejetée</p>
			<p class="text-sm text-red-600">Votre demande a été rejetée. Veuillez contacter la mairie pour plus d'informations.</p>
		</div>
	</div>
{:else}
	<div class="relative">
		{#each TIMELINE_STEPS as step, i}
			{@const entry = getStepEntry(step.key)}
			{@const isDone = i <= currentIndex}
			{@const isCurrent = i === currentIndex}
			<div class="flex gap-4 {i < TIMELINE_STEPS.length - 1 ? 'pb-6' : ''}">
				<!-- Icon column -->
				<div class="flex flex-col items-center">
					<div class="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 transition-all
						{isDone ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}
						{isCurrent ? 'ring-4 ring-primary-200' : ''}">
						{#if isDone}
							{#if isCurrent}
								{step.icon}
							{:else}
								<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
								</svg>
							{/if}
						{:else}
							<span class="w-3 h-3 rounded-full bg-gray-300"></span>
						{/if}
					</div>
					{#if i < TIMELINE_STEPS.length - 1}
						<div class="w-0.5 flex-1 mt-1 {isDone ? 'bg-primary-300' : 'bg-gray-200'}"></div>
					{/if}
				</div>

				<!-- Content -->
				<div class="flex-1 min-w-0 pb-1">
					<p class="font-semibold {isDone ? 'text-gray-800' : 'text-gray-400'} {isCurrent ? 'text-primary-700' : ''}">
						{step.label}
					</p>
					{#if entry}
						<p class="text-xs text-gray-500 mt-0.5">{formatDateTime(entry.date)}</p>
						{#if entry.note}
							<p class="text-sm text-gray-600 mt-1 bg-gray-50 rounded-lg px-3 py-1.5">{entry.note}</p>
						{/if}
					{:else if !isDone}
						<p class="text-xs text-gray-400 mt-0.5">En attente</p>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
