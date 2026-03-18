<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { authRole } from '$lib/stores/auth.js';

	onMount(() => {
		if ($authRole !== 'superadmin' && !$page.url.pathname.endsWith('/login')) {
			goto('/superadmin/login');
		}
	});
</script>

<slot />
