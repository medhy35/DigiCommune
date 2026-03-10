<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let activeTab = 'naissance';

	onMount(() => {
		const type = $page.url.searchParams.get('type');
		if (type && ['naissance', 'mariage', 'deces'].includes(type)) activeTab = type;
	});

	const demarches = {
		naissance: {
			label: 'Naissance',
			icon: '👶',
			color: 'blue',
			sections: [
				{
					id: 'declaration',
					title: 'Déclaration de naissance',
					subtitle: 'Enregistrer une naissance à l\'état civil',
					icon: '📋',
					urgent: true,
					delai: '3 mois à compter du jour de la naissance',
					delaiColor: 'red',
					description: 'La déclaration de naissance est obligatoire pour tout enfant né en Côte d\'Ivoire. Elle doit être effectuée dans un délai de 3 mois à compter de la naissance.',
					documents: [
						{
							label: 'Certificat de naissance',
							desc: 'Comportant le numéro d\'enregistrement, la signature du médecin ou de la sage-femme et le cachet du Centre médical.',
							required: true,
							icon: '🏥'
						},
						{
							label: 'Pièce d\'identité de la mère',
							desc: 'Carte nationale d\'identité, extrait de naissance, passeport ou certificat de nationalité.',
							required: true,
							icon: '🪪'
						},
						{
							label: 'Pièce d\'identité du père',
							desc: 'Carte nationale d\'identité, extrait de naissance, passeport ou certificat de nationalité.',
							required: true,
							icon: '🪪'
						},
						{
							label: 'Copie de l\'acte de mariage',
							desc: 'Uniquement si les parents sont mariés.',
							required: false,
							icon: '💍'
						}
					],
					frais: null,
					note: 'La déclaration tardive (au-delà de 3 mois) peut être effectuée, mais nécessite une procédure judiciaire particulière. Contactez la mairie pour plus d\'informations.'
				},
				{
					id: 'acte',
					title: 'Demande d\'acte de naissance',
					subtitle: 'Obtenir une copie ou un extrait',
					icon: '📄',
					urgent: false,
					delai: 'Traitement sous 24h',
					delaiColor: 'green',
					description: 'Un acte de naissance peut donner lieu à la délivrance de 2 documents différents : la copie intégrale et l\'extrait simple.',
					types: [
						{
							label: 'Copie intégrale',
							desc: 'Comporte les informations sur la personne concernée (nom, prénoms, date et lieu de naissance), les informations sur ses parents et les mentions marginales lorsqu\'elles existent.',
							icon: '📃'
						},
						{
							label: 'Extrait simple',
							desc: 'Comporte uniquement les informations sur la personne concernée par l\'acte de naissance.',
							icon: '📝'
						}
					],
					documents: [
						{
							label: 'Pièce d\'identité',
							desc: 'Carte nationale d\'identité, passeport ou tout document officiel valide.',
							required: true,
							icon: '🪪'
						},
						{
							label: 'Copie de l\'extrait de naissance',
							desc: 'Si vous en disposez, pour faciliter la recherche dans les registres.',
							required: false,
							icon: '📋'
						}
					],
					frais: { montant: 500, unite: 'FCFA', par: 'copie' },
					cta: { label: 'Faire une demande en ligne', href: '/demande?type=naissance' }
				}
			]
		},
		mariage: {
			label: 'Mariage',
			icon: '💍',
			color: 'rose',
			sections: [
				{
					id: 'acte_mariage',
					title: 'Demande d\'acte de mariage',
					subtitle: 'Obtenir une copie ou un extrait',
					icon: '📄',
					urgent: false,
					delai: 'Traitement sous 24h',
					delaiColor: 'green',
					description: 'Un acte de mariage peut être demandé par les époux, leurs ascendants, descendants, ou toute personne justifiant d\'un intérêt légitime.',
					documents: [
						{
							label: 'Pièce d\'identité du demandeur',
							desc: 'Carte nationale d\'identité, passeport ou tout document officiel valide.',
							required: true,
							icon: '🪪'
						},
						{
							label: 'Date et lieu du mariage',
							desc: 'Pour faciliter la recherche dans les registres. Si vous n\'avez pas le numéro de registre, indiquez les noms et date approximative.',
							required: false,
							icon: '📋'
						}
					],
					frais: { montant: 500, unite: 'FCFA', par: 'copie' },
					cta: { label: 'Faire une demande en ligne', href: '/demande?type=mariage' }
				}
			]
		},
		deces: {
			label: 'Décès',
			icon: '🕊️',
			color: 'slate',
			sections: [
				{
					id: 'declaration_deces',
					title: 'Déclaration de décès',
					subtitle: 'Enregistrer un décès à l\'état civil',
					icon: '📋',
					urgent: true,
					delai: '24 heures suivant le décès',
					delaiColor: 'red',
					description: 'La déclaration de décès est obligatoire et doit être effectuée dans les 24 heures suivant le constat du décès, auprès de la mairie du lieu de décès.',
					documents: [
						{
							label: 'Certificat médical de décès',
							desc: 'Délivré par le médecin ayant constaté le décès ou par l\'établissement hospitalier.',
							required: true,
							icon: '🏥'
						},
						{
							label: 'Pièce d\'identité du déclarant',
							desc: 'La personne qui déclare le décès (proche, représentant légal).',
							required: true,
							icon: '🪪'
						},
						{
							label: 'Pièce d\'identité du défunt',
							desc: 'Si disponible (carte nationale d\'identité, passeport, livret de famille).',
							required: false,
							icon: '🪪'
						}
					],
					frais: null,
					note: 'En cas de décès à domicile, la déclaration doit être faite par un proche ou toute autre personne présente. En cas de décès dans un établissement hospitalier, celui-ci peut se charger des démarches.'
				},
				{
					id: 'acte_deces',
					title: 'Demande d\'acte de décès',
					subtitle: 'Obtenir une copie',
					icon: '📄',
					urgent: false,
					delai: 'Traitement sous 24h',
					delaiColor: 'green',
					description: 'Un acte de décès est nécessaire pour les successions, les démarches auprès des assurances, la pension de réversion et d\'autres démarches administratives.',
					documents: [
						{
							label: 'Pièce d\'identité du demandeur',
							desc: 'Carte nationale d\'identité, passeport ou tout document officiel valide.',
							required: true,
							icon: '🪪'
						},
						{
							label: 'Informations sur le défunt',
							desc: 'Nom, prénoms, date approximative de décès pour faciliter la recherche.',
							required: false,
							icon: '📋'
						}
					],
					frais: { montant: 500, unite: 'FCFA', par: 'copie' },
					cta: { label: 'Faire une demande en ligne', href: '/demande?type=deces' }
				}
			]
		}
	};

	const tabs = ['naissance', 'mariage', 'deces'];

	let openSections = {};
	function toggleSection(id) {
		openSections[id] = !openSections[id];
		openSections = { ...openSections };
	}

	$: currentDemarche = demarches[activeTab];
</script>

<svelte:head>
	<title>Guide des démarches – CiviCI</title>
</svelte:head>

<!-- Header -->
<header class="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
	<div class="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
		<a href="/" class="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg">
			<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
			</svg>
		</a>
		<div class="flex items-center gap-2">
			<div class="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
				<span class="text-white font-syne font-bold text-xs">C</span>
			</div>
			<span class="font-syne font-semibold text-primary-600">CiviCI</span>
		</div>
		<span class="text-gray-300">|</span>
		<span class="text-gray-600 text-sm font-medium">Guide des démarches</span>
	</div>
</header>

<!-- Hero -->
<section class="bg-gradient-to-br from-gray-800 to-gray-900 text-white py-10 px-4">
	<div class="max-w-4xl mx-auto">
		<div class="inline-flex items-center gap-2 bg-white/10 rounded-full px-3 py-1 text-xs mb-4">
			<span class="w-1.5 h-1.5 bg-primary-400 rounded-full"></span>
			Informations officielles de la mairie
		</div>
		<h1 class="font-syne font-bold text-2xl sm:text-3xl mb-2">Guide des démarches d'état civil</h1>
		<p class="text-gray-300 max-w-xl">Retrouvez toutes les informations sur les documents requis, délais et frais pour chaque type de démarche.</p>
	</div>
</section>

<main class="max-w-4xl mx-auto px-4 sm:px-6 py-8">

	<!-- Tabs -->
	<div class="flex gap-2 mb-8 overflow-x-auto pb-1">
		{#each tabs as tab}
			{@const d = demarches[tab]}
			<button
				on:click={() => activeTab = tab}
				class="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all
					{activeTab === tab
						? 'bg-primary-500 text-white shadow-md'
						: 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'}"
			>
				<span>{d.icon}</span>
				{d.label}
			</button>
		{/each}
	</div>

	<!-- Sections -->
	<div class="space-y-4">
		{#each currentDemarche.sections as section}
			<div class="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">

				<!-- Section header (toujours visible) -->
				<button
					class="w-full p-5 text-left hover:bg-gray-50 transition-colors"
					on:click={() => toggleSection(section.id)}
				>
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-start gap-3">
							<div class="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
								{section.icon}
							</div>
							<div>
								<div class="flex items-center gap-2 flex-wrap">
									<h2 class="font-syne font-bold text-gray-800">{section.title}</h2>
									{#if section.urgent}
										<span class="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">Délai légal</span>
									{/if}
								</div>
								<p class="text-sm text-gray-500 mt-0.5">{section.subtitle}</p>

								<!-- Délai badge -->
								<div class="flex items-center gap-1.5 mt-2">
									<svg class="w-4 h-4 {section.delaiColor === 'red' ? 'text-red-500' : 'text-primary-500'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									<span class="text-xs font-medium {section.delaiColor === 'red' ? 'text-red-600' : 'text-primary-600'}">
										{section.delai}
									</span>
								</div>
							</div>
						</div>
						<svg
							class="w-5 h-5 text-gray-400 flex-shrink-0 transition-transform mt-1 {openSections[section.id] !== false ? 'rotate-180' : ''}"
							fill="none" viewBox="0 0 24 24" stroke="currentColor"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
						</svg>
					</div>
				</button>

				<!-- Section content (ouvert par défaut si pas explicitement fermé) -->
				{#if openSections[section.id] !== false}
					<div class="px-5 pb-5 border-t border-gray-50">
						<!-- Description -->
						{#if section.description}
							<p class="text-sm text-gray-600 mt-4 mb-4 leading-relaxed">{section.description}</p>
						{/if}

						<!-- Types (copie intégrale vs extrait simple) -->
						{#if section.types}
							<div class="grid sm:grid-cols-2 gap-3 mb-5">
								{#each section.types as type}
									<div class="bg-gray-50 rounded-xl p-4 border border-gray-100">
										<div class="flex items-center gap-2 mb-1.5">
											<span class="text-lg">{type.icon}</span>
											<span class="font-semibold text-gray-800 text-sm">{type.label}</span>
										</div>
										<p class="text-xs text-gray-600 leading-relaxed">{type.desc}</p>
									</div>
								{/each}
							</div>
						{/if}

						<!-- Documents requis -->
						<div class="mb-4">
							<h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
								<svg class="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
								</svg>
								Documents à fournir
							</h3>
							<div class="space-y-2.5">
								{#each section.documents as doc}
									<div class="flex items-start gap-3 p-3 rounded-xl {doc.required ? 'bg-primary-50 border border-primary-100' : 'bg-gray-50 border border-gray-100'}">
										<span class="text-xl flex-shrink-0 mt-0.5">{doc.icon}</span>
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 flex-wrap">
												<span class="font-medium text-sm {doc.required ? 'text-primary-800' : 'text-gray-700'}">{doc.label}</span>
												<span class="text-xs px-1.5 py-0.5 rounded {doc.required ? 'bg-primary-200 text-primary-700' : 'bg-gray-200 text-gray-600'}">
													{doc.required ? 'Obligatoire' : 'Facultatif'}
												</span>
											</div>
											<p class="text-xs {doc.required ? 'text-primary-700' : 'text-gray-500'} mt-0.5 leading-relaxed">{doc.desc}</p>
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- Frais -->
						{#if section.frais}
							<div class="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3.5 mb-4">
								<span class="text-2xl">💰</span>
								<div>
									<p class="font-semibold text-amber-800 text-sm">Frais de timbre</p>
									<p class="text-amber-700 text-sm">
										<span class="font-bold text-base">{section.frais.montant.toLocaleString('fr-FR')} {section.frais.unite}</span>
										<span> par {section.frais.par}</span>
									</p>
								</div>
							</div>
						{:else}
							<div class="flex items-center gap-3 bg-primary-50 border border-primary-100 rounded-xl p-3.5 mb-4">
								<span class="text-2xl">✅</span>
								<div>
									<p class="font-semibold text-primary-800 text-sm">Démarche gratuite</p>
									<p class="text-primary-700 text-xs">Aucuns frais ne sont applicables pour cette démarche.</p>
								</div>
							</div>
						{/if}

						<!-- Note -->
						{#if section.note}
							<div class="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3.5 mb-4">
								<svg class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
								</svg>
								<p class="text-xs text-blue-700 leading-relaxed">{section.note}</p>
							</div>
						{/if}

						<!-- CTA -->
						{#if section.cta}
							<a href={section.cta.href} class="btn-primary text-sm">
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
								</svg>
								{section.cta.label}
							</a>
						{:else}
							<a href="/suivi" class="btn-secondary text-sm">
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
								</svg>
								Contacter la mairie
							</a>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Contact info -->
	<div class="mt-8 bg-gray-800 text-white rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
		<div>
			<p class="font-syne font-semibold text-lg mb-1">Une question ?</p>
			<p class="text-gray-300 text-sm">Nos agents sont disponibles pour vous accompagner dans vos démarches.</p>
		</div>
		<a href="/demande" class="btn-accent whitespace-nowrap flex-shrink-0">
			Faire une demande en ligne
		</a>
	</div>

</main>
