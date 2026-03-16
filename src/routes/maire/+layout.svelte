<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authRole } from '$lib/stores/auth.js';
	import { commune } from '$lib/stores/commune.js';
	import BackofficeNav from '$lib/components/BackofficeNav.svelte';

	let escaladeCount = 0;

	onMount(async () => {
		if (!$authRole || $authRole !== 'maire') {
			goto('/agent/login');
			return;
		}
		const res = await fetch('/api/demandes?escalade_level=maire');
		if (res.ok) {
			const escalades = await res.json();
			escaladeCount = escalades.length;
		}
	});
</script>

<div class="min-h-screen bg-gray-50">
	<BackofficeNav commune={$commune} {escaladeCount} />
	<slot />
</div>
