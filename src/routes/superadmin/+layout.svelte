<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authRole } from '$lib/stores/auth.js';

	onMount(() => {
		if ($authRole !== 'superadmin') goto('/login');
	});
</script>

{#if $authRole === 'superadmin'}
	<slot />
{/if}
