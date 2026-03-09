<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { authRole, ROLE_LABELS, ROLE_COLORS } from '$lib/stores/auth.js';

	export let commune = null;
	export let escaladeCount = 0;

	function logout() {
		authRole.logout();
		goto('/agent/login');
	}

	$: role = $authRole;
	$: roleLabel = ROLE_LABELS[role] || role;
	$: roleColor = ROLE_COLORS[role] || 'bg-gray-100 text-gray-600';

	const navItems = {
		agent: [
			{ href: '/agent', label: 'Tableau de bord', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
			{ href: '/agent', label: 'Mes demandes', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' }
		],
		superviseur: [
			{ href: '/superviseur', label: 'Tableau de bord', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
			{ href: '/superviseur?tab=escalades', label: 'Escalades', icon: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', badge: escaladeCount }
		],
		maire: [
			{ href: '/maire', label: 'Vue synthétique', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
			{ href: '/maire?tab=critiques', label: 'Cas critiques', icon: 'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', badge: escaladeCount }
		]
	};

	$: currentNav = navItems[role] || [];
</script>

<nav class="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
	<div class="max-w-7xl mx-auto px-4 sm:px-6">
		<div class="flex items-center justify-between h-14">
			<!-- Left: Logo + Nav -->
			<div class="flex items-center gap-6">
				<a href="/" class="flex items-center gap-2 mr-2">
					<div class="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
						<span class="text-white font-syne font-bold text-sm">C</span>
					</div>
					<span class="font-syne font-bold text-primary-600 hidden sm:block">CiviCI</span>
				</a>

				{#each currentNav as item}
					<a
						href={item.href}
						class="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors
							{$page.url.pathname === item.href || $page.url.href.includes(item.href)
								? 'bg-primary-50 text-primary-700'
								: 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon}/>
						</svg>
						<span class="hidden sm:block">{item.label}</span>
						{#if item.badge > 0}
							<span class="bg-accent-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center leading-none">
								{item.badge}
							</span>
						{/if}
					</a>
				{/each}
			</div>

			<!-- Right: Role + Logout -->
			<div class="flex items-center gap-3">
				<span class="text-xs font-medium px-2.5 py-1 rounded-full {roleColor}">
					{roleLabel}
				</span>
				<button on:click={logout} class="btn-ghost text-sm py-1.5">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
					</svg>
					<span class="hidden sm:block">Déconnexion</span>
				</button>
			</div>
		</div>
	</div>
</nav>
