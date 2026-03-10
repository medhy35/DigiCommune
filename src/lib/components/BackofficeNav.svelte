<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { authRole, ROLE_LABELS, ROLE_COLORS } from '$lib/stores/auth.js';

	export let commune = null;
	export let escaladeCount = 0;

	let notifications = [];
	let showNotifDropdown = false;

	function logout() {
		authRole.logout();
		goto('/agent/login');
	}

	$: role = $authRole;
	$: roleLabel = ROLE_LABELS[role] || role;
	$: roleColor = ROLE_COLORS[role] || 'bg-gray-100 text-gray-600';
	$: unreadCount = notifications.filter(n => !n.read).length;

	let pollInterval;

	onMount(async () => {
		if (role) {
			await fetchNotifications();
			pollInterval = setInterval(fetchNotifications, 30000);
		}
	});

	onDestroy(() => {
		if (pollInterval) clearInterval(pollInterval);
	});

	async function fetchNotifications() {
		try {
			const res = await fetch(`/api/notifications?role=${role}`);
			if (res.ok) notifications = await res.json();
		} catch {}
	}

	async function markRead(notif) {
		if (notif.read) return;
		await fetch(`/api/notifications/${notif.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ read: true })
		});
		notifications = notifications.map(n => n.id === notif.id ? { ...n, read: true } : n);
	}

	async function markAllRead() {
		const unread = notifications.filter(n => !n.read);
		await Promise.all(unread.map(n => fetch(`/api/notifications/${n.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ read: true })
		})));
		notifications = notifications.map(n => ({ ...n, read: true }));
	}

	function openNotif(notif) {
		markRead(notif);
		showNotifDropdown = false;
		if (!notif.demande_id) return;
		if (role === 'agent') goto(`/agent/demande/${notif.demande_id}`);
		else if (role === 'superviseur') goto(`/superviseur`);
		else if (role === 'maire') goto(`/maire?tab=critiques`);
	}

	const TYPE_ICONS = {
		nouvelle_demande: '📋',
		escalade: '⚠️',
		escalade_critique: '🚨',
		info: 'ℹ️'
	};

	function timeAgo(isoString) {
		const diff = Date.now() - new Date(isoString).getTime();
		const m = Math.floor(diff / 60000);
		if (m < 1) return 'à l\'instant';
		if (m < 60) return `il y a ${m} min`;
		const h = Math.floor(m / 60);
		if (h < 24) return `il y a ${h}h`;
		return `il y a ${Math.floor(h / 24)}j`;
	}

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

<!-- Overlay pour fermer le dropdown en cliquant dehors -->
{#if showNotifDropdown}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div class="fixed inset-0 z-30" on:click={() => showNotifDropdown = false}></div>
{/if}

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

			<!-- Right: Notifications + Role + Logout -->
			<div class="flex items-center gap-2">

				<!-- Cloche notifications -->
				<div class="relative">
					<button
						on:click={() => showNotifDropdown = !showNotifDropdown}
						class="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						title="Notifications"
					>
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
								d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
						</svg>
						{#if unreadCount > 0}
							<span class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
								{unreadCount > 9 ? '9+' : unreadCount}
							</span>
						{/if}
					</button>

					<!-- Dropdown notifications -->
					{#if showNotifDropdown}
						<div class="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
							<!-- Header -->
							<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
								<div class="flex items-center gap-2">
									<h3 class="font-syne font-semibold text-gray-800 text-sm">Notifications</h3>
									{#if unreadCount > 0}
										<span class="bg-red-100 text-red-600 text-xs font-bold px-1.5 py-0.5 rounded-full">{unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}</span>
									{/if}
								</div>
								{#if unreadCount > 0}
									<button on:click={markAllRead} class="text-xs text-primary-600 hover:text-primary-700 font-medium">
										Tout lire
									</button>
								{/if}
							</div>

							<!-- Liste -->
							<div class="max-h-80 overflow-y-auto">
								{#if notifications.length === 0}
									<div class="text-center py-8 text-gray-400">
										<p class="text-3xl mb-2">🔔</p>
										<p class="text-sm">Aucune notification</p>
									</div>
								{:else}
									{#each notifications as notif}
										<button
											on:click={() => openNotif(notif)}
											class="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0
												{!notif.read ? 'bg-primary-50/40' : ''}"
										>
											<div class="flex items-start gap-3">
												<span class="text-lg flex-shrink-0 mt-0.5">{TYPE_ICONS[notif.type] || '🔔'}</span>
												<div class="flex-1 min-w-0">
													<p class="text-sm text-gray-800 leading-snug {!notif.read ? 'font-medium' : ''}">{notif.message}</p>
													<p class="text-xs text-gray-400 mt-0.5">{timeAgo(notif.created_at)}</p>
												</div>
												{#if !notif.read}
													<div class="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1.5"></div>
												{/if}
											</div>
										</button>
									{/each}
								{/if}
							</div>

							<!-- Footer -->
							<div class="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
								<p class="text-xs text-gray-400 text-center">{notifications.length} notification{notifications.length > 1 ? 's' : ''} au total</p>
							</div>
						</div>
					{/if}
				</div>

				<span class="text-xs font-medium px-2.5 py-1 rounded-full {roleColor}">
					{roleLabel}
				</span>
				<a href="/settings" class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Paramètres">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
					</svg>
				</a>
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
