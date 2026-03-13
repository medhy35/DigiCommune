<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let commune = null;
	let searchNumero = '';
	let searching = false;
	let searchError = '';

	onMount(async () => {
		const res = await fetch('/api/commune');
		commune = await res.json();
	});

	async function handleSearch() {
		if (!searchNumero.trim()) return;
		searching = true;
		searchError = '';
		const res = await fetch(`/api/demandes/${searchNumero.trim().toUpperCase()}`);
		if (res.ok) {
			goto(`/suivi/${searchNumero.trim().toUpperCase()}`);
		} else {
			searchError = 'Aucune demande trouvée avec ce numéro. Vérifiez le format : CI-XXXXXXXXXX';
		}
		searching = false;
	}

	const services = [
		{
			type: 'naissance',
			icon: '👶',
			label: 'Acte de naissance',
			desc: 'Copie intégrale pour vous-même, un enfant ou un parent né dans la commune.',
			color: 'from-blue-50 to-sky-50',
			border: 'border-blue-200',
			iconBg: 'bg-blue-100'
		},
		{
			type: 'mariage',
			icon: '💍',
			label: 'Acte de mariage',
			desc: 'Copie intégrale d\'un acte de mariage célébré en mairie.',
			color: 'from-rose-50 to-pink-50',
			border: 'border-rose-200',
			iconBg: 'bg-rose-100'
		},
		{
			type: 'deces',
			icon: '🕊️',
			label: 'Acte de décès',
			desc: 'Acte de décès pour successions, démarches administratives et assurances.',
			color: 'from-slate-50 to-gray-50',
			border: 'border-slate-200',
			iconBg: 'bg-slate-100'
		}
	];

	const autresServices = [
		{ icon: '🤝', label: 'Attestation de concubinage', tab: 'attestations', href: '/demande?type=attestation_concubinage', online: true },
		{ icon: '🏠', label: 'Attestation de domicile', tab: 'attestations', href: '/demarches?type=attestations', online: false },
		{ icon: '✅', label: 'Certification de documents', tab: 'certifications', href: '/demande?type=certification_documents', online: true },
		{ icon: '🔏', label: 'Légalisation de signature', tab: 'certifications', href: '/demande?type=legalisation', online: true },
		{ icon: '📖', label: 'Inscription au livret de famille', tab: 'livret', href: '/demarches?type=livret', online: false },
		{ icon: '📋', label: 'Duplicata du livret de famille', tab: 'livret', href: '/demande?type=duplicata_livret', online: true },
		{ icon: '💍', label: 'Dossier de mariage', tab: 'mariage', href: '/demarches?type=mariage', online: false },
		{ icon: '🎖️', label: 'Recensement militaire', tab: 'attestations', href: '/demarches?type=attestations', online: false },
		{ icon: '👨‍👩‍👧', label: 'Certificat de vie et entretien', tab: 'certificats', href: '/demande?type=certificat_vie_entretien', online: true },
		{ icon: '👴', label: 'Certificat de vie adulte', tab: 'certificats', href: '/demarches?type=certificats', online: false },
		{ icon: '👪', label: 'Fiche familiale d\'état civil', tab: 'certificats', href: '/demande?type=fiche_familiale', online: true },
		{ icon: '🙋', label: 'Fiche individuelle d\'état civil', tab: 'certificats', href: '/demande?type=fiche_individuelle', online: true },
		{ icon: '🔍', label: 'Copie d\'extrait égaré', tab: 'naissance', href: '/demarches?type=naissance', online: false }
	];
</script>

<svelte:head>
	<title>CiviCI – {commune?.nom || 'Portail Citoyen'}</title>
</svelte:head>

<!-- HEADER -->
<header class="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
	<div class="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center shadow-sm">
				<span class="text-white font-syne font-bold text-lg leading-none">C</span>
			</div>
			<div>
				<span class="font-syne font-bold text-xl text-primary-600">CiviCI</span>
				{#if commune}
					<p class="text-xs text-gray-500 leading-tight">{commune.nom}</p>
				{/if}
			</div>
		</div>
		<a href="/suivi" class="btn-secondary text-sm py-2">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
			</svg>
			Suivre ma demande
		</a>
	</div>
</header>

<!-- HERO -->
<section class="bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700 text-white relative overflow-hidden">
	<!-- Decorative circles -->
	<div class="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full translate-x-1/3 -translate-y-1/3"></div>
	<div class="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -translate-x-1/4 translate-y-1/4"></div>

	<div class="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 relative z-10">
		<div class="max-w-2xl">
			<div class="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
				<span class="w-2 h-2 bg-accent-400 rounded-full animate-pulse"></span>
				<span class="text-sm font-medium">Service disponible 24h/24</span>
			</div>
			<h1 class="font-syne font-bold text-3xl sm:text-5xl leading-tight mb-4">
				Vos actes civils<br>en ligne,<br>
				<span class="text-accent-300">livrés en 24h</span>
			</h1>
			<p class="text-lg text-primary-100 mb-8 max-w-lg">
				Demandez votre acte de naissance, de mariage ou de décès depuis chez vous. Nos agents traitent votre dossier et vous contactent rapidement.
			</p>
			<div class="flex flex-col sm:flex-row gap-3">
				<a href="/demande" class="btn-accent text-base px-7 py-3 shadow-lg shadow-accent-900/20">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
					</svg>
					Faire une demande
				</a>
				<a href="/suivi" class="bg-white/15 hover:bg-white/25 text-white font-semibold px-7 py-3 rounded-lg transition-all duration-200 inline-flex items-center gap-2 backdrop-blur-sm">
					<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
					</svg>
					Suivre mon dossier
				</a>
			</div>
		</div>
	</div>
</section>

<!-- SERVICES -->
<section class="max-w-6xl mx-auto px-4 sm:px-6 py-16">
	<div class="text-center mb-10">
		<h2 class="font-syne font-bold text-2xl sm:text-3xl text-gray-800 mb-3">Nos services en ligne</h2>
		<p class="text-gray-500 max-w-lg mx-auto">Choisissez le type d'acte dont vous avez besoin. La procédure est simple et rapide.</p>
	</div>

	<div class="grid sm:grid-cols-3 gap-6">
		{#each services as service}
			<div class="bg-gradient-to-br {service.color} border {service.border} rounded-2xl p-6 flex flex-col hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1">
				<div class="w-14 h-14 {service.iconBg} rounded-2xl flex items-center justify-center text-2xl mb-4">
					{service.icon}
				</div>
				<h3 class="font-syne font-bold text-lg text-gray-800 mb-2">{service.label}</h3>
				<p class="text-sm text-gray-600 leading-relaxed flex-1">{service.desc}</p>
				<div class="mt-5 flex items-center gap-2">
					<a href="/demande?type={service.type}" class="btn-primary text-sm py-2 flex-1 justify-center">
						Faire une demande
					</a>
					<a
						href="/demarches?type={service.type}"
						class="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
						title="Guide de la démarche"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
					</a>
				</div>
			</div>
		{/each}
	</div>

	<!-- Lien guide -->
	<div class="mt-6 text-center">
		<a href="/demarches" class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition-colors">
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
			</svg>
			Consulter le guide complet des démarches (documents requis, délais, frais)
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
			</svg>
		</a>
	</div>

	<!-- Autres services -->
	<div class="mt-12 pt-10 border-t border-gray-100">
		<div class="flex items-center justify-between mb-6">
			<div>
				<h2 class="font-syne font-bold text-xl text-gray-800">Autres services disponibles</h2>
				<p class="text-sm text-gray-500 mt-1">Démarches disponibles en mairie — certaines peuvent être initiées en ligne.</p>
			</div>
		</div>
		<div class="grid sm:grid-cols-2 gap-2.5">
			{#each autresServices as s}
				<a
					href={s.href}
					class="flex items-center gap-3 p-3.5 rounded-xl border border-gray-100 bg-white hover:border-primary-200 hover:bg-primary-50/30 transition-all group"
				>
					<span class="text-xl flex-shrink-0">{s.icon}</span>
					<span class="flex-1 text-sm font-medium text-gray-700 group-hover:text-primary-700">{s.label}</span>
					{#if s.online}
						<span class="text-xs bg-primary-100 text-primary-700 font-medium px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">En ligne</span>
					{:else}
						<span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">En mairie</span>
					{/if}
				</a>
			{/each}
		</div>
	</div>
</section>

<!-- SUIVI RAPIDE -->
<section class="bg-gray-50 border-y border-gray-100">
	<div class="max-w-6xl mx-auto px-4 sm:px-6 py-14">
		<div class="max-w-lg mx-auto text-center">
			<div class="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">📬</div>
			<h2 class="font-syne font-bold text-2xl text-gray-800 mb-2">Suivre ma demande</h2>
			<p class="text-gray-500 mb-6">Saisissez votre numéro de dossier pour connaître l'état d'avancement de votre demande.</p>

			<form on:submit|preventDefault={handleSearch} class="flex gap-2">
				<input
					type="text"
					bind:value={searchNumero}
					placeholder="Ex : CI-1741231847"
					class="input-field flex-1 text-center font-mono uppercase"
					maxlength="16"
				/>
				<button type="submit" class="btn-primary whitespace-nowrap" disabled={searching}>
					{#if searching}
						<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
						</svg>
					{:else}
						Suivre
					{/if}
				</button>
			</form>

			{#if searchError}
				<p class="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{searchError}</p>
			{/if}
		</div>
	</div>
</section>

<!-- INFO SECTION -->
<section class="max-w-6xl mx-auto px-4 sm:px-6 py-16">
	<div class="grid sm:grid-cols-3 gap-8">
		{#each [
			{ icon: '⚡', title: 'Traitement rapide', desc: 'Vos demandes sont traitées en moins de 24 heures par nos agents assermentés.' },
			{ icon: '📱', title: 'Livraison WhatsApp', desc: 'Recevez votre acte en PDF directement sur votre téléphone via WhatsApp.' },
			{ icon: '🔒', title: 'Démarche sécurisée', desc: 'Vos données personnelles sont protégées et traitées de manière confidentielle.' }
		] as item}
			<div class="flex gap-4">
				<div class="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">{item.icon}</div>
				<div>
					<h3 class="font-syne font-semibold text-gray-800 mb-1">{item.title}</h3>
					<p class="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
				</div>
			</div>
		{/each}
	</div>
</section>

<!-- FOOTER -->
<footer class="bg-gray-800 text-gray-300">
	<div class="max-w-6xl mx-auto px-4 sm:px-6 py-10">
		<div class="flex flex-col sm:flex-row justify-between gap-8">
			<div>
				<div class="flex items-center gap-2 mb-3">
					<div class="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
						<span class="text-white font-syne font-bold text-sm">C</span>
					</div>
					<span class="font-syne font-bold text-white text-lg">CiviCI</span>
				</div>
				{#if commune}
					<p class="text-sm">{commune.nom}</p>
					<p class="text-sm">{commune.adresse}</p>
					<p class="text-sm mt-1">Tél. : {commune.telephone}</p>
				{/if}
			</div>
			<div>
				<h4 class="font-syne font-semibold text-white mb-3">Liens utiles</h4>
				<ul class="space-y-1.5 text-sm">
					<li><a href="/demande" class="hover:text-white transition-colors">Faire une demande</a></li>
					<li><a href="/suivi" class="hover:text-white transition-colors">Suivre ma demande</a></li>
					<li><a href="/agent/login" class="hover:text-white transition-colors">Espace agent</a></li>
				</ul>
			</div>
			<div>
				<h4 class="font-syne font-semibold text-white mb-3">Informations</h4>
				<ul class="space-y-1.5 text-sm">
					<li>Service disponible 24h/24</li>
					<li>Réponse sous 24 heures</li>
					<li>Gratuit pour le citoyen</li>
				</ul>
			</div>
		</div>
		<div class="border-t border-gray-700 mt-8 pt-6 text-center text-xs text-gray-500">
			© 2025 CiviCI – Portail de gestion municipal de la Côte d'Ivoire. Tous droits réservés.
		</div>
	</div>
</footer>
