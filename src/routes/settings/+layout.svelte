<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authRole } from '$lib/stores/auth.js';
	import { commune } from '$lib/stores/commune.js';
	import BackofficeNav from '$lib/components/BackofficeNav.svelte';

	onMount(() => {
		if (!$authRole) goto('/agent/login');
	});
</script>

<div class="min-h-screen bg-gray-50">
	<BackofficeNav commune={$commune} />
	<slot />
</div>
