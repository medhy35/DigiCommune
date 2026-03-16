<script>
	/** Commune object with optional `logo` (URL) and `nom_app` (string) */
	export let commune = null;
	/** Tailwind w-*/h-* classes, e.g. "w-8 h-8" */
	export let size = 'w-8 h-8';
	/** Tailwind rounded-* class */
	export let rounded = 'rounded-lg';
	/** Optional Tailwind shadow class */
	export let shadow = '';
	/** Background for the fallback monogram box */
	export let fallbackBg = 'bg-primary-500';
	/** Override the fallback icon/character (default: first letter of nom_app) */
	export let fallbackContent = null;
</script>

{#if commune?.logo}
	<img
		src={commune.logo}
		alt={commune.nom_app || 'Logo'}
		class="{size} {rounded} object-contain {shadow}"
	/>
{:else}
	<div class="{size} {fallbackBg} {rounded} flex items-center justify-center flex-shrink-0 {shadow}">
		<span class="text-white font-syne font-bold text-sm leading-none">
			{fallbackContent ?? (commune?.nom_app || 'C')[0]}
		</span>
	</div>
{/if}
