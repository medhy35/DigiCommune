<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authRole } from '$lib/stores/auth.js';
	import BackofficeNav from '$lib/components/BackofficeNav.svelte';

	let escaladeCount = 0;
	let commune = null;

	onMount(async () => {
		if (!$authRole || $authRole !== 'superviseur') {
			goto('/agent/login');
			return;
		}
		const [cRes, dRes] = await Promise.all([
			fetch('/api/commune'),
			fetch('/api/demandes?escalade_level=superviseur')
		]);
		commune = await cRes.json();
		const escalades = await dRes.json();
		escaladeCount = escalades.length;
	});
</script>

<div class="min-h-screen bg-gray-50">
	<BackofficeNav {commune} {escaladeCount} />
	<slot />
</div>
