<script>
	import { STATUT_LABELS, STATUT_COLORS, isEscaladee } from '$lib/utils/helpers.js';

	export let demande;

	$: escaladed = isEscaladee(demande);
	$: label = escaladed
		? `Escaladée → ${demande.escalade.level}`
		: STATUT_LABELS[demande.statut] || demande.statut;
	$: colorClass = escaladed ? 'badge-escaladee' : STATUT_COLORS[demande.statut] || 'badge-recue';
</script>

<span class={colorClass}>
	{#if escaladed}
		<svg class="inline w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
		</svg>
	{/if}
	{label}
</span>
