<!-- Composant réutilisable : détail complet d'une demande pour les 3 rôles back-office -->
<script>
	import Timeline from './Timeline.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import {
		TYPE_ACTE_LABELS, TYPE_ACTE_ICONS, CONCERNANT_LABELS,
		MODE_RECEPTION_LABELS, formatDate, formatDateTime, isEscaladee
	} from '$lib/utils/helpers.js';

	export let demande;
	export let showTimeline = true;
	export let compact = false; // moins de padding pour les side panels

	// Lightbox pour preview document image
	let lightboxSrc = null;
	let lightboxName = '';

	function openLightbox(doc) {
		if (!doc.data) return;
		lightboxSrc = doc.data;
		lightboxName = doc.nom;
	}

	function isImage(mimetype) { return mimetype?.startsWith('image/'); }
	function isPdf(mimetype) { return mimetype === 'application/pdf'; }
	function formatSize(bytes) {
		if (!bytes) return '';
		if (bytes < 1024) return `${bytes} o`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} Ko`;
		return `${(bytes / 1048576).toFixed(1)} Mo`;
	}
</script>

{#if demande}
<div class="space-y-4 {compact ? 'text-sm' : ''}">

	<!-- En-tête statut + type -->
	<div class="flex items-start justify-between gap-3">
		<div>
			<div class="flex items-center gap-2 flex-wrap">
				<span class="font-mono font-bold {compact ? 'text-base' : 'text-lg'} text-gray-800">{demande.id}</span>
				<StatusBadge {demande} />
				{#if isEscaladee(demande)}
					<span class="badge-escaladee">⚠️ Escalade → {demande.escalade.level}</span>
				{/if}
			</div>
			<p class="text-xs text-gray-400 mt-0.5">Soumis le {formatDateTime(demande.created_at)}</p>
		</div>
		<span class="text-3xl">{TYPE_ACTE_ICONS[demande.type_acte]}</span>
	</div>

	<!-- Demandeur -->
	<div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
		<h3 class="font-syne font-semibold text-gray-600 text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5">
			<span class="w-5 h-5 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-xs">👤</span>
			Demandeur
		</h3>
		<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
			<div>
				<dt class="text-xs text-gray-400">Nom complet</dt>
				<dd class="font-medium mt-0.5">{demande.demandeur.prenom} {demande.demandeur.nom}</dd>
			</div>
			<div>
				<dt class="text-xs text-gray-400">Date de naissance</dt>
				<dd class="font-medium mt-0.5">{formatDate(demande.demandeur.date_naissance)}</dd>
			</div>
			<div>
				<dt class="text-xs text-gray-400">Téléphone</dt>
				<dd class="font-medium mt-0.5 text-primary-600">{demande.demandeur.telephone}</dd>
			</div>
			<div>
				<dt class="text-xs text-gray-400">CNI</dt>
				<dd class="font-medium mt-0.5">{demande.demandeur.cni || '—'}</dd>
			</div>
		</dl>
	</div>

	<!-- Détails de la demande -->
	<div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
		<h3 class="font-syne font-semibold text-gray-600 text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5">
			<span class="text-base">{TYPE_ACTE_ICONS[demande.type_acte]}</span>
			{TYPE_ACTE_LABELS[demande.type_acte]}
		</h3>
		<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
			<div>
				<dt class="text-xs text-gray-400">Concernant</dt>
				<dd class="font-medium mt-0.5">{CONCERNANT_LABELS[demande.concernant]}</dd>
			</div>
			<div>
				<dt class="text-xs text-gray-400">Personne concernée</dt>
				<dd class="font-medium mt-0.5">{demande.personne_concernee.prenom} {demande.personne_concernee.nom}</dd>
			</div>
			<div>
				<dt class="text-xs text-gray-400">Date de l'acte</dt>
				<dd class="font-medium mt-0.5">
					{demande.personne_concernee.date_evenement ? formatDate(demande.personne_concernee.date_evenement) : '—'}
				</dd>
			</div>
			<div>
				<dt class="text-xs text-gray-400">N° de registre</dt>
				<dd class="mt-0.5">
					{#if demande.personne_concernee.numero_registre}
						<span class="font-medium font-mono text-xs">{demande.personne_concernee.numero_registre}</span>
					{:else}
						<span class="text-amber-600 text-xs">Non renseigné ⚠️</span>
					{/if}
				</dd>
			</div>
			<div>
				<dt class="text-xs text-gray-400">Copies</dt>
				<dd class="font-medium mt-0.5">{demande.copies}</dd>
			</div>
			<div>
				<dt class="text-xs text-gray-400">Réception</dt>
				<dd class="font-medium mt-0.5">{MODE_RECEPTION_LABELS[demande.mode_reception]}</dd>
			</div>
		</dl>
	</div>

	<!-- Documents déposés -->
	<div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
		<h3 class="font-syne font-semibold text-gray-600 text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5">
			<span class="text-base">📎</span>
			Documents justificatifs
		</h3>

		{#if demande.documents && demande.documents.length > 0}
			<div class="space-y-3">
				{#each demande.documents as doc}
					<div class="border border-gray-100 rounded-xl overflow-hidden">
						<!-- Info fichier -->
						<div class="flex items-center gap-3 p-3 bg-gray-50">
							<span class="text-xl flex-shrink-0">{({'cni':'🪪','extrait':'📋','passeport':'🛂','justificatif':'📎'})[doc.type] || '📄'}</span>
							<div class="flex-1 min-w-0">
								<p class="font-medium text-gray-800 text-sm truncate" title={doc.nom}>{doc.nom}</p>
								<p class="text-xs text-gray-400">
									{({'cni':"Pièce d'identité",'extrait':"Extrait d'acte",'passeport':'Passeport','justificatif':'Justificatif'})[doc.type] || doc.type}
									{#if doc.taille} · {formatSize(doc.taille)}{/if}
								</p>
							</div>
							{#if doc.data}
								{#if isImage(doc.mimetype)}
									<button
										on:click={() => openLightbox(doc)}
										class="flex items-center gap-1.5 text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 font-medium px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
									>
										<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
										</svg>
										Voir
									</button>
								{:else if isPdf(doc.mimetype)}
									<a
										href={doc.data}
										download={doc.nom}
										class="flex items-center gap-1.5 text-xs bg-red-50 text-red-700 hover:bg-red-100 font-medium px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
									>
										<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
										</svg>
										PDF
									</a>
								{/if}
							{:else}
								<span class="text-xs text-gray-400 bg-gray-100 px-2.5 py-1.5 rounded-lg">Métadonnées seules</span>
							{/if}
						</div>

						<!-- Aperçu image (thumbnail) -->
						{#if doc.data && isImage(doc.mimetype)}
							<button
								on:click={() => openLightbox(doc)}
								class="w-full block hover:opacity-90 transition-opacity"
								title="Cliquer pour agrandir"
							>
								<img
									src={doc.data}
									alt={doc.nom}
									class="w-full max-h-40 object-cover"
								/>
							</button>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl p-3">
				<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
				</svg>
				Aucun document joint — vérification en présentiel requise.
			</div>
		{/if}
	</div>

	<!-- Paiement -->
	{#if demande.paiement}
		<div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm
			{demande.paiement.statut === 'paye' ? 'border-l-4 border-primary-400' : 'border-l-4 border-amber-400'}">
			<h3 class="font-syne font-semibold text-gray-600 text-xs uppercase tracking-wide mb-3 flex items-center gap-1.5">
				<span class="text-base">🏦</span> Frais de timbre
			</h3>
			<div class="flex items-center justify-between">
				<div>
					{#if demande.paiement.statut === 'paye'}
						<p class="font-semibold text-primary-700 flex items-center gap-1.5">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
							</svg>
							Payé en ligne
						</p>
						{#if demande.paiement.reference}
							<p class="text-xs text-gray-400 font-mono mt-0.5">Réf. {demande.paiement.reference}</p>
						{/if}
						{#if demande.paiement.operateur}
							<p class="text-xs text-gray-500 mt-0.5 capitalize">{demande.paiement.operateur} Mobile Money</p>
						{/if}
					{:else}
						<p class="font-semibold text-amber-700">⏳ À percevoir en mairie</p>
						<p class="text-xs text-gray-400 mt-0.5">À encaisser au retrait</p>
					{/if}
				</div>
				<div class="text-right">
					<p class="font-syne font-bold text-xl text-gray-800">{demande.paiement.montant?.toLocaleString('fr-FR')}</p>
					<p class="text-xs text-gray-400">FCFA</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Timeline -->
	{#if showTimeline}
		<div class="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
			<h3 class="font-syne font-semibold text-gray-600 text-xs uppercase tracking-wide mb-4">Historique</h3>
			<Timeline historique={demande.historique} statut={demande.statut} />
		</div>
	{/if}

	<!-- Escalade -->
	{#if isEscaladee(demande)}
		<div class="bg-orange-50 border border-orange-200 rounded-xl p-4">
			<h3 class="font-semibold text-orange-800 flex items-center gap-2 mb-2 text-sm">
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
				</svg>
				Escalade → {demande.escalade.level}
			</h3>
			<p class="text-sm text-orange-700 leading-relaxed">{demande.escalade.motif}</p>
			<p class="text-xs text-orange-400 mt-1.5">{formatDateTime(demande.escalade.date)}</p>
		</div>
	{/if}
</div>
{/if}

<!-- LIGHTBOX document image -->
{#if lightboxSrc}
	<div
		role="dialog"
		aria-modal="true"
		aria-label="Prévisualisation du document"
		class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4"
		on:click|self={() => lightboxSrc = null}
		on:keydown={(e) => e.key === 'Escape' && (lightboxSrc = null)}
	>
		<div class="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full">
			<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
				<p class="font-medium text-sm text-gray-700 truncate">{lightboxName}</p>
				<div class="flex items-center gap-2">
					<a href={lightboxSrc} download={lightboxName}
						class="text-xs text-primary-600 hover:underline flex items-center gap-1">
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
						</svg>
						Télécharger
					</a>
					<button on:click={() => lightboxSrc = null} class="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg">
						<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>
			<img src={lightboxSrc} alt={lightboxName} class="w-full max-h-[70vh] object-contain bg-gray-50"/>
		</div>
	</div>
{/if}
