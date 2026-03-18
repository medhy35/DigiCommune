<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authRole } from '$lib/stores/auth.js';

	onMount(() => {
		if ($authRole !== 'superadmin') goto('/superadmin/login');
	});
</script>

{#if $authRole === 'superadmin'}
	<slot />
{/if}
