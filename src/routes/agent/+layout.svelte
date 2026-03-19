<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authUser, authRole } from '$lib/stores/auth.js';
	import { commune } from '$lib/stores/commune.js';
	import BackofficeNav from '$lib/components/BackofficeNav.svelte';

	let escaladeCount = 0;

	onMount(async () => {
		await authUser.load();
		if (!$authRole || $authRole !== 'agent') {
			goto('/agent/login');
			return;
		}
		const res = await fetch('/api/demandes?escalade_level=superviseur');
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
