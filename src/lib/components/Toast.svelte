<script>
	import { fly } from 'svelte/transition';
	import { toasts } from '$lib/stores/toast.js';

	const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
	const COLORS = {
		success: 'bg-primary-600 text-white',
		error: 'bg-red-500 text-white',
		info: 'bg-gray-800 text-white',
		warning: 'bg-amber-500 text-white'
	};
</script>

<div class="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" aria-live="polite">
	{#each $toasts as t (t.id)}
		<div
			transition:fly={{ x: 80, duration: 250 }}
			class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-xs {COLORS[t.type] || COLORS.info}"
		>
			<span class="flex-shrink-0">{ICONS[t.type] || ICONS.info}</span>
			<span>{t.message}</span>
		</div>
	{/each}
</div>
