<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { authRole, authUser } from '$lib/stores/auth.js';
	import { TYPE_ACTE_LABELS, TYPE_ACTE_ICONS } from '$lib/utils/helpers.js';
	import CommuneLogo from '$lib/components/CommuneLogo.svelte';

	let activeTab = 'overview';
	let loading = true;
	let saving = false;
	let toast = null;

	let stats = {};
	let par_type = {};
	let settings = {};
	let users = { agents: [], superviseurs: [], maire: null };
	let commune = {};

	// Formulaire nouvel utilisateur
	let showAddUser = false;
	let newUser = { prenom: '', nom: '', email: '', role: 'agent' };
	let addUserError = '';

	// Formulaire verrouillage
	const LOCKABLE_PARAMS = [
		{ key: 'sla_heures',                         label: 'SLA Agent (heures)',                   role: 'agent' },
		{ key: 'seuil_escalades_alerte',              label: 'Seuil alertes escalades',              role: 'superviseur' },
		{ key: 'periode_dashboard',                   label: 'Période dashboard Maire',              role: 'maire' },
		{ key: 'frais_copie',                         label: 'Frais copie (FCFA)',                   role: 'global' },
		{ key: 'frais_copie_integrale',               label: 'Frais copie intégrale (FCFA)',         role: 'global' },
		{ key: 'frais_urgence',                       label: 'Frais traitement urgent (FCFA)',       role: 'global' },
		{ key: 'sla_heures_defaut',                   label: 'SLA par défaut (heures)',              role: 'global' },
		{ key: 'delai_declaration_naissance_jours',   label: 'Délai déclaration naissance (jours)', role: 'global' },
		{ key: 'delai_declaration_deces_jours',       label: 'Délai déclaration décès (jours)',     role: 'global' },
		{ key: 'max_pieces_jointes',                  label: 'Nb max pièces jointes',               role: 'global' },
		{ key: 'whatsapp_actif',                      label: 'Livraison WhatsApp activée',          role: 'global' },
		{ key: 'notif_agent_nouvelle_demande',        label: 'Notif agent : nouvelle demande',      role: 'agent' },
		{ key: 'notif_agent_escalade_resolue',        label: 'Notif agent : escalade résolue',      role: 'agent' },
		{ key: 'notif_agent_reassignation',           label: 'Notif agent : réassignation',         role: 'agent' },
		{ key: 'notif_superviseur_nouvelle_escalade', label: 'Notif superviseur : escalade',        role: 'superviseur' },
		{ key: 'notif_maire_cas_critique',            label: 'Notif maire : cas critique',          role: 'maire' },
		{ key: 'securite_session_heures',             label: 'Durée de session (heures)',            role: 'global' },
		{ key: 'theme',                               label: 'Thème interface',                      role: 'global' },
		{ key: 'taille_police',                       label: 'Taille de police',                    role: 'global' }
	];

	// Formulaire paramètres globaux éditables
	let globalEdit = {};
	let communeEdit = {};

	// Paramètres par rôle (notifications, etc.)
	let agentNotifs  = {};
	let supNotifs    = {};
	let maireEdit    = {};
	let savingRole   = null;

	// Identité / Branding
	let identiteEdit = {};
	let savingIdentite = false;
	let logoUploading = false;
	let logoToast = null;

	function hexToRgb(hex) {
		const h = hex.replace('#', '');
		return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
	}
	function blend(hex, target, amount) {
		const [r1,g1,b1] = hexToRgb(hex);
		const r = Math.round(Math.max(0, Math.min(255, r1+(target[0]-r1)*amount)));
		const g = Math.round(Math.max(0, Math.min(255, g1+(target[1]-g1)*amount)));
		const b = Math.round(Math.max(0, Math.min(255, b1+(target[2]-b1)*amount)));
		return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
	}
	function applyTheme(hex) {
		if (!hex) return;
		const white=[255,255,255], black=[0,0,0], root=document.documentElement;
		root.style.setProperty('--color-p50',  blend(hex,white,0.92));
		root.style.setProperty('--color-p100', blend(hex,white,0.82));
		root.style.setProperty('--color-p200', blend(hex,white,0.64));
		root.style.setProperty('--color-p300', blend(hex,white,0.44));
		root.style.setProperty('--color-p400', blend(hex,white,0.22));
		root.style.setProperty('--color-p500', hex);
		root.style.setProperty('--color-p600', blend(hex,black,0.10));
		root.style.setProperty('--color-p700', blend(hex,black,0.22));
		root.style.setProperty('--color-p800', blend(hex,black,0.38));
		root.style.setProperty('--color-p900', blend(hex,black,0.52));
	}

	async function handleLogoUpload(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		logoUploading = true;
		const reader = new FileReader();
		reader.onload = (ev) => {
			identiteEdit.logo = ev.target.result;
			logoUploading = false;
			e.target.value = '';
		};
		reader.readAsDataURL(file);
	}

	async function saveIdentite() {
		savingIdentite = true;
		if (identiteEdit.couleur_primaire) applyTheme(identiteEdit.couleur_primaire);
		const res = await fetch('/api/commune', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(identiteEdit)
		});
		savingIdentite = false;
		if (res.ok) {
			commune = { ...commune, ...identiteEdit };
			showToast('Identité de la mairie enregistrée');
		} else {
			showToast('Erreur lors de la sauvegarde', 'error');
		}
	}

	const TABS = [
		{ id: 'overview',  label: 'Vue d\'ensemble', icon: '📊' },
		{ id: 'identite',  label: 'Identité',        icon: '🏛️' },
		{ id: 'modules',   label: 'Modules',         icon: '🧩' },
		{ id: 'users',     label: 'Utilisateurs',    icon: '👥' },
		{ id: 'params',    label: 'Paramètres',      icon: '⚙️' },
		{ id: 'locks',     label: 'Verrouillages',   icon: '🔒' },
		{ id: 'modeles',   label: 'Modèles docs',    icon: '📄' },
		{ id: 'journal',   label: 'Journal d\'audit',icon: '📜' },
		{ id: 'securite',  label: 'Sécurité',        icon: '🛡️' }
	];

	// ── Templates / Modèles de documents ─────────────────────
	let templates = [];
	let templatesLoading = false;
	let uploadingType = null;
	let templateToasts = {};

	async function loadTemplates() {
		templatesLoading = true;
		const res = await fetch('/api/templates');
		if (res.ok) templates = await res.json();
		templatesLoading = false;
	}

	async function handleTemplateUpload(type_acte, e) {
		const file = e.target.files?.[0];
		if (!file) return;
		uploadingType = type_acte;
		const reader = new FileReader();
		reader.onload = async (ev) => {
			const res = await fetch('/api/templates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type_acte,
					nom_fichier: file.name,
					taille: file.size,
					data: ev.target.result,
					uploaded_by: 'superadmin'
				})
			});
			if (res.ok) {
				templateToasts = { ...templateToasts, [type_acte]: 'ok' };
				await loadTemplates();
				setTimeout(() => { templateToasts = { ...templateToasts, [type_acte]: null }; }, 3000);
			}
			uploadingType = null;
			e.target.value = '';
		};
		reader.readAsDataURL(file);
	}

	async function deleteTemplate(type_acte) {
		await fetch(`/api/templates?type=${type_acte}`, { method: 'DELETE' });
		await loadTemplates();
	}

	// ── Journal de sécurité ──────────────────────────────────
	let secLog = [];
	let secLoading = false;
	let secSearch = '';
	let secTypeFilter = '';
	let secClearConfirm = false;

	// label + color en un seul objet — évite la désynchronisation des deux maps
	const SEC_TYPES = {
		// Authentification
		connexion:            { label: 'Connexion',             color: 'bg-green-100 text-green-700' },
		deconnexion:          { label: 'Déconnexion',           color: 'bg-gray-100 text-gray-600' },
		// Administration système
		module_toggle:        { label: 'Module activé/désactivé', color: 'bg-blue-100 text-blue-700' },
		settings_change:      { label: 'Paramètres globaux',    color: 'bg-indigo-100 text-indigo-700' },
		role_settings_change: { label: 'Paramètres rôle',       color: 'bg-violet-100 text-violet-700' },
		param_lock:           { label: 'Verrouillage param',    color: 'bg-orange-100 text-orange-700' },
		param_unlock:         { label: 'Déverrouillage param',  color: 'bg-amber-100 text-amber-700' },
		user_add:             { label: 'Ajout utilisateur',     color: 'bg-teal-100 text-teal-700' },
		user_update:          { label: 'Modif utilisateur',     color: 'bg-cyan-100 text-cyan-700' },
		user_toggle:          { label: 'Activ. utilisateur',    color: 'bg-sky-100 text-sky-700' },
		template_upload:      { label: 'Modèle chargé',         color: 'bg-purple-100 text-purple-700' },
		template_delete:      { label: 'Modèle supprimé',       color: 'bg-red-100 text-red-600' },
		identite_change:      { label: 'Identité mairie',       color: 'bg-primary-100 text-primary-700' },
		journal_efface:       { label: 'Journal effacé',        color: 'bg-red-200 text-red-800' },
		// Actions dossiers (agent / superviseur / maire)
		statut_change:        { label: 'Changement statut',     color: 'bg-blue-100 text-blue-800' },
		note_interne:         { label: 'Note interne',          color: 'bg-slate-100 text-slate-700' },
		acte_valide:          { label: 'Acte validé',           color: 'bg-emerald-100 text-emerald-700' },
		escalade_ajout:       { label: 'Escalade',              color: 'bg-orange-100 text-orange-700' },
		escalade_resolue:     { label: 'Escalade résolue',      color: 'bg-lime-100 text-lime-700' },
		reassignation:        { label: 'Réassignation',         color: 'bg-cyan-100 text-cyan-800' },
		paiement_valide:      { label: 'Paiement validé',       color: 'bg-green-100 text-green-800' },
		remboursement_initie: { label: 'Remboursement initié',  color: 'bg-yellow-100 text-yellow-700' },
		remboursement_valide: { label: 'Remboursement effectué', color: 'bg-amber-100 text-amber-800' },
		complement_demande:   { label: 'Compléments demandés',  color: 'bg-purple-100 text-purple-700' }
	};
	const SEC_ACTEUR_ICONS = {
		superadmin:  '🔐',
		agent:       '👩‍💼',
		superviseur: '👔',
		maire:       '🏛️'
	};

	async function loadSecLog() {
		secLoading = true;
		const res = await fetch('/api/security-log?limit=500');
		if (res.ok) {
			const data = await res.json();
			secLog = data.entries;
		}
		secLoading = false;
	}

	async function clearSecLog() {
		await fetch('/api/security-log', { method: 'DELETE' });
		await loadSecLog();
		secClearConfirm = false;
		showToast('Journal de sécurité effacé');
	}

	$: filteredSecLog = secLog.filter(e => {
		const matchType = !secTypeFilter || e.type === secTypeFilter;
		const q = secSearch.toLowerCase();
		const matchSearch = !q ||
			e.acteur.toLowerCase().includes(q) ||
			e.type.toLowerCase().includes(q) ||
			JSON.stringify(e.details).toLowerCase().includes(q);
		return matchType && matchSearch;
	});

	// ── Journal d'audit ───────────────────────────────────────
	let auditLog = [];
	let auditLoading = false;
	let auditFilter = '';
	let auditTypeFilter = '';

	async function loadAudit() {
		auditLoading = true;
		const res = await fetch('/api/audit?limit=500');
		if (res.ok) auditLog = await res.json();
		auditLoading = false;
	}

	$: filteredAudit = auditLog.filter(e => {
		const q = auditFilter.toLowerCase();
		const matchSearch = !q || e.demande_id.toLowerCase().includes(q) || e.demandeur.toLowerCase().includes(q) || e.par.toLowerCase().includes(q) || (e.note || '').toLowerCase().includes(q);
		const matchType = !auditTypeFilter || e.action === auditTypeFilter;
		return matchSearch && matchType;
	});

	const AUDIT_LABELS = {
		changement_statut: 'Changement statut',
		note_interne: 'Note interne',
		escalade: 'Escalade',
		remboursement: 'Remboursement'
	};
	const AUDIT_COLORS = {
		changement_statut: 'bg-blue-100 text-blue-700',
		note_interne: 'bg-indigo-100 text-indigo-700',
		escalade: 'bg-orange-100 text-orange-700',
		remboursement: 'bg-red-100 text-red-700'
	};
	const ROLE_ICONS = { agent: '👤', superviseur: '👔', maire: '🏛️', superadmin: '🔐' };

	onMount(async () => {
		await loadAll();
	});

	async function loadAll() {
		loading = true;
		const [adminRes, communeRes] = await Promise.all([
			fetch('/api/admin'),
			fetch('/api/commune')
		]);
		if (adminRes.ok) {
			const data = await adminRes.json();
			stats = data.stats;
			par_type = data.par_type;
			settings = data.settings;
			users = data.users;
			globalEdit = { ...(data.settings.global || {}) };
			globalEdit.frais_fixes          = { ...(data.settings.global?.frais_fixes || {}) };
			const rdvCfg                    = data.settings.rdv || {};
			globalEdit.rdv_heure_debut      = rdvCfg.heure_debut      ?? '08:00';
			globalEdit.rdv_heure_fin        = rdvCfg.heure_fin         ?? '16:00';
			globalEdit.rdv_duree_creneau    = rdvCfg.duree_creneau     ?? 30;
			globalEdit.rdv_max_par_creneau  = rdvCfg.max_rdv_par_creneau ?? 3;
			globalEdit.rdv_delai_min_jours  = rdvCfg.delai_min_jours   ?? 1;
			globalEdit.rdv_delai_max_jours  = rdvCfg.delai_max_jours   ?? 30;
			globalEdit.rdv_lieu             = rdvCfg.lieu               ?? 'Mairie';
			globalEdit.rdv_jours_ouvrables  = rdvCfg.jours_ouvrables   ?? [1,2,3,4,5];
			delete globalEdit.modules;
			delete globalEdit.locked_params;
			agentNotifs = { ...(data.settings.agent?.notifications  || {}) };
			supNotifs   = { ...(data.settings.superviseur?.notifications || {}) };
			maireEdit   = {
				periode_dashboard: data.settings.maire?.periode_dashboard ?? 'mois',
				...(data.settings.maire?.notifications || {})
			};
		}
		if (communeRes.ok) {
			commune = await communeRes.json();
			communeEdit = { ...commune };
			identiteEdit = {
				nom: commune.nom,
				nom_app: commune.nom_app || 'CiviCI',
				slogan: commune.slogan || '',
				couleur_primaire: commune.couleur_primaire || '#009A44',
				horaires_ouverture: commune.horaires_ouverture || '',
				logo: commune.logo || null
			};
		}
		loading = false;
	}

	function showToast(msg, type = 'success') {
		toast = { msg, type };
		setTimeout(() => toast = null, 3000);
	}

	async function toggleModule(key) {
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'toggle_module', module: key })
		});
		if (res.ok) {
			const d = await res.json();
			settings.global.modules[key] = d.enabled;
			settings = { ...settings };
			showToast(`Module "${TYPE_ACTE_LABELS[key] || key}" ${d.enabled ? 'activé' : 'désactivé'}`);
		}
	}

	async function saveGlobalParams() {
		saving = true;
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'save_global', data: globalEdit })
		});
		saving = false;
		if (res.ok) showToast('Paramètres globaux enregistrés');
		else showToast('Erreur lors de la sauvegarde', 'error');
	}

	async function saveRoleSettings(role, data) {
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'save_role_settings', role, data })
		});
		if (res.ok) {
			settings[role] = { ...settings[role], ...data };
			showToast(`Paramètres ${role} enregistrés`);
		}
	}

	async function saveAgentNotifs() {
		savingRole = 'agent';
		await saveRoleSettings('agent', { notifications: { ...agentNotifs } });
		savingRole = null;
	}

	async function saveSupNotifs() {
		savingRole = 'superviseur';
		await saveRoleSettings('superviseur', { notifications: { ...supNotifs } });
		savingRole = null;
	}

	async function saveRdvSettings() {
		saving = true;
		const rdvData = {
			heure_debut:          globalEdit.rdv_heure_debut,
			heure_fin:            globalEdit.rdv_heure_fin,
			duree_creneau:        globalEdit.rdv_duree_creneau,
			max_rdv_par_creneau:  globalEdit.rdv_max_par_creneau,
			delai_min_jours:      globalEdit.rdv_delai_min_jours,
			delai_max_jours:      globalEdit.rdv_delai_max_jours,
			lieu:                 globalEdit.rdv_lieu,
			jours_ouvrables:      globalEdit.rdv_jours_ouvrables
		};
		await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'save_rdv_settings', data: rdvData })
		});
		saving = false;
		showToast('Paramètres RDV enregistrés');
	}

	async function saveMaireSettings() {
		savingRole = 'maire';
		const { periode_dashboard, ...notifs } = maireEdit;
		await saveRoleSettings('maire', { periode_dashboard, notifications: notifs });
		savingRole = null;
	}

	async function toggleLock(param) {
		const locked = settings.global.locked_params || [];
		const isLocked = locked.includes(param);
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: isLocked ? 'unlock_param' : 'lock_param', param })
		});
		if (res.ok) {
			if (isLocked) {
				settings.global.locked_params = locked.filter(p => p !== param);
			} else {
				settings.global.locked_params = [...locked, param];
			}
			settings = { ...settings };
			showToast(`Paramètre "${param}" ${isLocked ? 'déverrouillé' : 'verrouillé'}`);
		}
	}

	let createdUserPassword = '';
	let showPasswordModal = false;

	async function addUser() {
		addUserError = '';
		if (!newUser.prenom || !newUser.nom || !newUser.email) {
			addUserError = 'Tous les champs sont requis.';
			return;
		}
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'add_user', role: newUser.role, user: newUser })
		});
		if (res.ok) {
			const data = await res.json();
			await loadAll();
			showAddUser = false;
			newUser = { prenom: '', nom: '', email: '', role: 'agent' };
			createdUserPassword = data.default_password;
			showPasswordModal = true;
		}
	}

	async function toggleUser(userId, role) {
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'toggle_user', userId, role })
		});
		if (res.ok) await loadAll();
	}

	// Édition inline
	let editingUser = null;
	let editUserError = '';

	function startEdit(u) {
		editingUser = { id: u.id, role: u.role, prenom: u.prenom, nom: u.nom, email: u.email };
		editUserError = '';
	}

	async function saveEditUser() {
		editUserError = '';
		if (!editingUser.prenom || !editingUser.nom || !editingUser.email) {
			editUserError = 'Tous les champs sont requis.';
			return;
		}
		const res = await fetch('/api/admin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'update_user', userId: editingUser.id, role: editingUser.role, data: { prenom: editingUser.prenom, nom: editingUser.nom, email: editingUser.email, avatar: (editingUser.prenom[0] + editingUser.nom[0]).toUpperCase() } })
		});
		if (res.ok) {
			await loadAll();
			editingUser = null;
			showToast('Utilisateur modifié');
		} else {
			editUserError = 'Erreur lors de la sauvegarde.';
		}
	}

	function logout() {
		authUser.logout();
	}

	$: lockedParams = settings.global?.locked_params || [];
	$: modules = settings.global?.modules || {};
</script>

<svelte:head>
	<title>Super Admin – CiviCI</title>
</svelte:head>

<!-- Toast -->
{#if toast}
	<div class="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2
		{toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-primary-500 text-white'}">
		{toast.type === 'error' ? '❌' : '✅'} {toast.msg}
	</div>
{/if}

<!-- Header -->
<header class="bg-gray-900 text-white sticky top-0 z-40 shadow-lg">
	<div class="max-w-7xl mx-auto px-4 sm:px-6">
		<div class="flex items-center justify-between h-14">
			<div class="flex items-center gap-3">
				<CommuneLogo {commune} fallbackBg="bg-red-600" fallbackContent="🔐" />
				<div>
					<span class="font-syne font-bold text-white">{commune?.nom_app || 'CiviCI'}</span>
					<span class="text-gray-400 text-xs ml-2">Super Admin</span>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<span class="text-xs bg-red-800 text-red-200 px-2.5 py-1 rounded-full font-medium">Super Admin</span>
				<a href="/" class="text-xs text-gray-400 hover:text-white transition-colors">Portail citoyen</a>
				<button on:click={logout} class="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
					</svg>
					Déconnexion
				</button>
			</div>
		</div>
	</div>
</header>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 py-8">

		{#if loading}
			<div class="flex items-center justify-center py-32 text-gray-400">
				<svg class="w-8 h-8 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
				</svg>
				Chargement...
			</div>
		{:else}

		<!-- Tabs -->
		<div class="flex gap-2 mb-8 overflow-x-auto pb-1">
			{#each TABS as tab}
				<button
					on:click={() => { activeTab = tab.id; if (tab.id === 'journal' && !auditLog.length) loadAudit(); if (tab.id === 'modeles' && !templates.length) loadTemplates(); if (tab.id === 'securite') loadSecLog(); }}
					class="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all
						{activeTab === tab.id ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'}"
				>
					<span>{tab.icon}</span>{tab.label}
				</button>
			{/each}
		</div>

		<!-- ── TAB: VUE D'ENSEMBLE ─────────────────────────────── -->
		{#if activeTab === 'overview'}
			<div class="space-y-6">
				<h1 class="font-syne font-bold text-2xl text-gray-800">Vue d'ensemble système</h1>

				<!-- KPIs -->
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
					{#each [
						{ label: 'Total demandes', value: stats.total, icon: '📋', color: 'bg-blue-50 border-blue-100', text: 'text-blue-700' },
						{ label: 'En attente', value: stats.recues + stats.en_cours, icon: '⏳', color: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
						{ label: 'Traitées', value: stats.traitees, icon: '✅', color: 'bg-primary-50 border-primary-100', text: 'text-primary-700' },
						{ label: 'Escaladées', value: stats.escaladees, icon: '⚠️', color: 'bg-red-50 border-red-100', text: 'text-red-700' }
					] as kpi}
						<div class="bg-white rounded-2xl border {kpi.color} p-5">
							<div class="text-2xl mb-2">{kpi.icon}</div>
							<p class="font-syne font-bold text-3xl {kpi.text}">{kpi.value ?? 0}</p>
							<p class="text-xs text-gray-500 mt-1">{kpi.label}</p>
						</div>
					{/each}
				</div>

				<div class="grid sm:grid-cols-3 gap-4">
					<div class="bg-white rounded-2xl border border-gray-100 p-5">
						<p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Agents actifs</p>
						<p class="font-syne font-bold text-3xl text-gray-800">{stats.agents_actifs ?? 0}</p>
					</div>
					<div class="bg-white rounded-2xl border border-gray-100 p-5">
						<p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Modules actifs</p>
						<p class="font-syne font-bold text-3xl text-gray-800">{stats.modules_actifs ?? 0} / {Object.keys(modules).length}</p>
					</div>
					<div class="bg-white rounded-2xl border border-gray-100 p-5">
						<p class="text-xs text-gray-400 uppercase tracking-wide mb-1">Params verrouillés</p>
						<p class="font-syne font-bold text-3xl text-gray-800">{lockedParams.length}</p>
					</div>
				</div>

				<!-- Répartition par service -->
				{#if Object.keys(par_type).length > 0}
				<div class="bg-white rounded-2xl border border-gray-100 p-6">
					<h2 class="font-syne font-semibold text-gray-700 mb-4">Demandes par service</h2>
					<div class="space-y-3">
						{#each Object.entries(par_type).sort((a,b) => b[1]-a[1]) as [type, count]}
							{@const total = stats.total || 1}
							<div class="flex items-center gap-3">
								<span class="text-lg w-8 text-center">{TYPE_ACTE_ICONS[type] || '📄'}</span>
								<span class="text-sm text-gray-700 w-48 truncate">{TYPE_ACTE_LABELS[type] || type}</span>
								<div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
									<div class="h-full bg-primary-500 rounded-full" style="width: {Math.round(count/total*100)}%"></div>
								</div>
								<span class="text-sm font-semibold text-gray-700 w-8 text-right">{count}</span>
							</div>
						{/each}
					</div>
				</div>
				{/if}
			</div>

		<!-- ── TAB: IDENTITÉ ──────────────────────────────────── -->
		{:else if activeTab === 'identite'}
			<div class="space-y-6">
				<div>
					<h1 class="font-syne font-bold text-2xl text-gray-800">Identité de la mairie</h1>
					<p class="text-sm text-gray-500 mt-1">Personnalisez le nom, le logo, la couleur principale et les informations de contact affichés sur l'ensemble de l'application.</p>
				</div>

				<div class="grid sm:grid-cols-2 gap-6">
					<!-- Logo -->
					<div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
						<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">🖼️ Logo</h2>
						<div class="flex items-center gap-4">
							<div class="w-16 h-16 rounded-xl border-2 border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
								{#if identiteEdit.logo}
									<img src={identiteEdit.logo} alt="Logo" class="w-full h-full object-contain" />
								{:else}
									<div class="w-full h-full flex items-center justify-center bg-primary-500 rounded-xl">
										<span class="text-white font-syne font-bold text-2xl">{(identiteEdit.nom_app || 'C')[0]}</span>
									</div>
								{/if}
							</div>
							<div class="flex-1 space-y-2">
								<label class="cursor-pointer">
									<input type="file" accept="image/*" class="hidden" on:change={handleLogoUpload} disabled={logoUploading} />
									<span class="inline-flex items-center gap-2 text-sm font-medium border-2 border-primary-300 text-primary-700 hover:border-primary-500 rounded-xl py-2 px-4 transition-colors cursor-pointer {logoUploading ? 'opacity-50' : ''}">
										{#if logoUploading}
											<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
										{:else}
											<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
										{/if}
										{identiteEdit.logo ? 'Remplacer' : 'Charger un logo'}
									</span>
								</label>
								{#if identiteEdit.logo}
									<button on:click={() => identiteEdit.logo = null} class="block text-xs text-red-500 hover:text-red-700">Supprimer le logo</button>
								{/if}
								<p class="text-xs text-gray-400">PNG, JPG ou SVG recommandé. Carré de préférence.</p>
							</div>
						</div>
					</div>

					<!-- Couleur principale -->
					<div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
						<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">🎨 Couleur principale</h2>
						<div class="flex items-center gap-4">
							<input
								type="color"
								bind:value={identiteEdit.couleur_primaire}
								on:input={(e) => applyTheme(e.target.value)}
								class="w-14 h-14 rounded-xl border-2 border-gray-200 cursor-pointer p-1"
							/>
							<div class="flex-1">
								<input type="text" bind:value={identiteEdit.couleur_primaire} class="input-field text-sm font-mono" placeholder="#009A44" maxlength="7" />
								<p class="text-xs text-gray-400 mt-1">La couleur est appliquée en temps réel.</p>
							</div>
						</div>
						<!-- Prévisualisation des teintes -->
						<div class="flex gap-1">
							{#each ['--color-p100','--color-p300','--color-p500','--color-p700','--color-p900'] as v}
								<div class="flex-1 h-6 rounded" style="background-color: var({v})"></div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Infos générales -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6">
					<h2 class="font-syne font-semibold text-gray-700 mb-5 flex items-center gap-2">🏛️ Informations générales</h2>
					<div class="grid sm:grid-cols-2 gap-4">
						<div>
							<label class="label text-xs">Nom de l'application</label>
							<input type="text" bind:value={identiteEdit.nom_app} class="input-field text-sm" placeholder="CiviCI" />
						</div>
						<div>
							<label class="label text-xs">Nom de la mairie</label>
							<input type="text" bind:value={identiteEdit.nom} class="input-field text-sm" placeholder="Mairie de Cocody" />
						</div>
						<div class="sm:col-span-2">
							<label class="label text-xs">Slogan</label>
							<input type="text" bind:value={identiteEdit.slogan} class="input-field text-sm" placeholder="Au service de nos concitoyens" />
						</div>
						<div class="sm:col-span-2">
							<label class="label text-xs">Horaires d'ouverture</label>
							<input type="text" bind:value={identiteEdit.horaires_ouverture} class="input-field text-sm" placeholder="Lun–Ven 7h30–16h00 · Sam 8h00–12h00" />
						</div>
					</div>
					<button on:click={saveIdentite} disabled={savingIdentite} class="btn-primary text-sm mt-5">
						{savingIdentite ? 'Enregistrement...' : 'Enregistrer l\'identité'}
					</button>
				</div>

				<!-- Aperçu -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6">
					<h2 class="font-syne font-semibold text-gray-700 mb-4">👁️ Aperçu du header</h2>
					<div class="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
						{#if identiteEdit.logo}
							<img src={identiteEdit.logo} alt="Logo" class="w-8 h-8 rounded-lg object-contain" />
						{:else}
							<div class="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
								<span class="text-white font-syne font-bold text-sm">{(identiteEdit.nom_app || 'C')[0]}</span>
							</div>
						{/if}
						<div>
							<span class="font-syne font-bold text-primary-600">{identiteEdit.nom_app || 'CiviCI'}</span>
							<p class="text-xs text-gray-500">{identiteEdit.nom || 'Mairie de Cocody'}</p>
						</div>
					</div>
				</div>
			</div>

		<!-- ── TAB: MODULES ────────────────────────────────────── -->
		{:else if activeTab === 'modules'}
			<div class="space-y-6">
				<div>
					<h1 class="font-syne font-bold text-2xl text-gray-800">Gestion des modules</h1>
					<p class="text-sm text-gray-500 mt-1">Activez ou désactivez les services proposés aux citoyens. Un module désactivé n'apparaît plus sur le portail.</p>
				</div>

				<div class="grid sm:grid-cols-2 gap-3">
					{#each Object.entries(modules) as [key, enabled]}
						<div class="bg-white rounded-xl border {enabled ? 'border-primary-200' : 'border-gray-200'} p-4 flex items-center gap-4">
							<span class="text-2xl">{TYPE_ACTE_ICONS[key] || '📄'}</span>
							<div class="flex-1">
								<p class="font-medium text-gray-800 text-sm">{TYPE_ACTE_LABELS[key] || key}</p>
								<p class="text-xs {enabled ? 'text-primary-600' : 'text-gray-400'}">{enabled ? 'Actif' : 'Désactivé'}</p>
							</div>
							<button
								on:click={() => toggleModule(key)}
								class="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0
									{enabled ? 'bg-primary-500' : 'bg-gray-300'}"
							>
								<span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300
									{enabled ? 'left-6' : 'left-0.5'}"></span>
							</button>
						</div>
					{/each}
				</div>

				<div class="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
					<span class="text-lg flex-shrink-0">⚠️</span>
					<p class="text-sm text-amber-800">Désactiver un module masque le service sur le portail citoyen mais ne supprime pas les demandes existantes de ce type.</p>
				</div>
			</div>

		<!-- ── TAB: UTILISATEURS ───────────────────────────────── -->
		{:else if activeTab === 'users'}
			<div class="space-y-6">
				<div class="flex items-center justify-between">
					<div>
						<h1 class="font-syne font-bold text-2xl text-gray-800">Gestion des utilisateurs</h1>
						<p class="text-sm text-gray-500 mt-1">Agents, superviseurs et maire de la mairie.</p>
					</div>
					<button on:click={() => { showAddUser = !showAddUser; addUserError = ''; }} class="btn-primary text-sm">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
						</svg>
						Nouvel utilisateur
					</button>
				</div>

				<!-- Formulaire ajout -->
				{#if showAddUser}
					<div class="bg-white rounded-2xl border border-gray-200 p-6">
						<h2 class="font-syne font-semibold text-gray-700 mb-4">Ajouter un utilisateur</h2>
						<div class="grid sm:grid-cols-2 gap-4 mb-4">
							<div>
								<label class="label text-xs">Prénom</label>
								<input type="text" bind:value={newUser.prenom} class="input-field text-sm" placeholder="Aminata"/>
							</div>
							<div>
								<label class="label text-xs">Nom</label>
								<input type="text" bind:value={newUser.nom} class="input-field text-sm" placeholder="KONÉ"/>
							</div>
							<div>
								<label class="label text-xs">Email</label>
								<input type="email" bind:value={newUser.email} class="input-field text-sm" placeholder="email@mairie.ci"/>
							</div>
							<div>
								<label class="label text-xs">Rôle</label>
								<select bind:value={newUser.role} class="input-field text-sm">
									<option value="agent">Agent</option>
									<option value="superviseur">Superviseur</option>
									<option value="maire">Maire</option>
								</select>
							</div>
						</div>
						{#if addUserError}<p class="text-xs text-red-500 mb-3">{addUserError}</p>{/if}
						<div class="flex gap-3">
							<button on:click={addUser} class="btn-primary text-sm">Ajouter</button>
							<button on:click={() => showAddUser = false} class="btn-secondary text-sm">Annuler</button>
						</div>
					</div>
				{/if}

				<!-- Agents -->
				<div>
					<h2 class="font-syne font-semibold text-gray-600 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
						<span class="w-2 h-2 bg-blue-400 rounded-full"></span> Agents ({users.agents?.length || 0})
					</h2>
					<div class="space-y-2">
						{#each users.agents || [] as agent}
							{#if editingUser?.id === agent.id}
								<div class="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
									<div class="grid grid-cols-3 gap-3">
										<input type="text" bind:value={editingUser.prenom} class="input-field text-sm" placeholder="Prénom" />
										<input type="text" bind:value={editingUser.nom} class="input-field text-sm" placeholder="Nom" />
										<input type="email" bind:value={editingUser.email} class="input-field text-sm" placeholder="Email" />
									</div>
									{#if editUserError}<p class="text-xs text-red-500">{editUserError}</p>{/if}
									<div class="flex gap-2">
										<button on:click={saveEditUser} class="btn-primary text-xs px-3 py-1.5">Enregistrer</button>
										<button on:click={() => editingUser = null} class="btn-secondary text-xs px-3 py-1.5">Annuler</button>
									</div>
								</div>
							{:else}
								<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
									<div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center font-syne font-bold text-blue-700 text-sm flex-shrink-0">
										{agent.avatar}
									</div>
									<div class="flex-1">
										<p class="font-medium text-gray-800 text-sm">{agent.prenom} {agent.nom}</p>
										<p class="text-xs text-gray-400">{agent.email}</p>
									</div>
									<span class="text-xs px-2 py-0.5 rounded-full font-medium {agent.actif !== false ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}">
										{agent.actif !== false ? 'Actif' : 'Inactif'}
									</span>
									<button on:click={() => startEdit({ ...agent, role: 'agent' })} class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">Modifier</button>
									<button on:click={() => toggleUser(agent.id, 'agent')} class="text-xs px-3 py-1.5 rounded-lg border transition-all {agent.actif !== false ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-primary-200 text-primary-600 hover:bg-primary-50'}">
										{agent.actif !== false ? 'Désactiver' : 'Réactiver'}
									</button>
								</div>
							{/if}
						{/each}
					</div>
				</div>

				<!-- Superviseurs -->
				<div>
					<h2 class="font-syne font-semibold text-gray-600 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
						<span class="w-2 h-2 bg-violet-400 rounded-full"></span> Superviseurs ({users.superviseurs?.length || 0})
					</h2>
					<div class="space-y-2">
						{#each users.superviseurs || [] as sup}
							{#if editingUser?.id === sup.id}
								<div class="bg-violet-50 rounded-xl border border-violet-200 p-4 space-y-3">
									<div class="grid grid-cols-3 gap-3">
										<input type="text" bind:value={editingUser.prenom} class="input-field text-sm" placeholder="Prénom" />
										<input type="text" bind:value={editingUser.nom} class="input-field text-sm" placeholder="Nom" />
										<input type="email" bind:value={editingUser.email} class="input-field text-sm" placeholder="Email" />
									</div>
									{#if editUserError}<p class="text-xs text-red-500">{editUserError}</p>{/if}
									<div class="flex gap-2">
										<button on:click={saveEditUser} class="btn-primary text-xs px-3 py-1.5">Enregistrer</button>
										<button on:click={() => editingUser = null} class="btn-secondary text-xs px-3 py-1.5">Annuler</button>
									</div>
								</div>
							{:else}
								<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
									<div class="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center font-syne font-bold text-violet-700 text-sm flex-shrink-0">
										{sup.avatar}
									</div>
									<div class="flex-1">
										<p class="font-medium text-gray-800 text-sm">{sup.prenom} {sup.nom}</p>
										<p class="text-xs text-gray-400">{sup.email}</p>
									</div>
									<span class="text-xs px-2 py-0.5 rounded-full font-medium {sup.actif !== false ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}">
										{sup.actif !== false ? 'Actif' : 'Inactif'}
									</span>
									<button on:click={() => startEdit({ ...sup, role: 'superviseur' })} class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">Modifier</button>
									<button on:click={() => toggleUser(sup.id, 'superviseur')} class="text-xs px-3 py-1.5 rounded-lg border transition-all {sup.actif !== false ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-primary-200 text-primary-600 hover:bg-primary-50'}">
										{sup.actif !== false ? 'Désactiver' : 'Réactiver'}
									</button>
								</div>
							{/if}
						{/each}
					</div>
				</div>

				<!-- Maire -->
				{#if users.maire}
				<div>
					<h2 class="font-syne font-semibold text-gray-600 text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
						<span class="w-2 h-2 bg-primary-400 rounded-full"></span> Maire
					</h2>
					{#if editingUser?.id === users.maire.id}
						<div class="bg-primary-50 rounded-xl border border-primary-200 p-4 space-y-3">
							<div class="grid grid-cols-3 gap-3">
								<input type="text" bind:value={editingUser.prenom} class="input-field text-sm" placeholder="Prénom" />
								<input type="text" bind:value={editingUser.nom} class="input-field text-sm" placeholder="Nom" />
								<input type="email" bind:value={editingUser.email} class="input-field text-sm" placeholder="Email" />
							</div>
							{#if editUserError}<p class="text-xs text-red-500">{editUserError}</p>{/if}
							<div class="flex gap-2">
								<button on:click={saveEditUser} class="btn-primary text-xs px-3 py-1.5">Enregistrer</button>
								<button on:click={() => editingUser = null} class="btn-secondary text-xs px-3 py-1.5">Annuler</button>
							</div>
						</div>
					{:else}
						<div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
							<div class="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center font-syne font-bold text-primary-700 text-sm flex-shrink-0">
								{users.maire.avatar}
							</div>
							<div class="flex-1">
								<p class="font-medium text-gray-800 text-sm">{users.maire.prenom} {users.maire.nom}</p>
								<p class="text-xs text-gray-400">{users.maire.email}</p>
							</div>
							<span class="text-xs px-2 py-0.5 rounded-full font-medium {users.maire.actif !== false ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}">
								{users.maire.actif !== false ? 'Actif' : 'Inactif'}
							</span>
							<button on:click={() => startEdit({ ...users.maire, role: 'maire' })} class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">Modifier</button>
							<button on:click={() => toggleUser(users.maire.id, 'maire')} class="text-xs px-3 py-1.5 rounded-lg border transition-all {users.maire.actif !== false ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-primary-200 text-primary-600 hover:bg-primary-50'}">
								{users.maire.actif !== false ? 'Désactiver' : 'Réactiver'}
							</button>
						</div>
					{/if}
				</div>
				{/if}
			</div>

		<!-- ── TAB: PARAMÈTRES ─────────────────────────────────── -->
		{:else if activeTab === 'params'}
			<div class="space-y-6">
				<h1 class="font-syne font-bold text-2xl text-gray-800">Paramètres</h1>

				<!-- ── Tarification ────────────────────────────────── -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
					<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">💰 Tarification</h2>
					<div class="grid sm:grid-cols-3 gap-4">
						{#each [
							{ key:'frais_copie',          label:'Frais de copie (FCFA)' },
							{ key:'frais_copie_integrale', label:'Copie intégrale (FCFA)' },
							{ key:'frais_urgence',         label:'Traitement urgent (FCFA)' }
						] as f}
							{@const locked = lockedParams.includes(f.key)}
							<div>
								<label class="label text-xs flex items-center gap-1">{f.label}{#if locked}<span class="text-red-500">🔒</span>{/if}</label>
								<input type="number" bind:value={globalEdit[f.key]} disabled={locked}
									class="input-field text-sm {locked ? 'bg-gray-50 opacity-60' : ''}" />
							</div>
						{/each}
						</div>

					<!-- Frais fixes par type de service -->
					<div class="pt-4 border-t border-gray-100">
						<h3 class="text-sm font-semibold text-gray-600 mb-3">Frais fixes par type de service</h3>
						<div class="grid sm:grid-cols-3 gap-4">
							{#each [
								{ key:'attestation_concubinage',   label:'Attestation concubinage' },
								{ key:'legalisation',              label:'Légalisation' },
								{ key:'duplicata_livret',           label:'Duplicata livret' },
								{ key:'certificat_vie_entretien',   label:'Cert. vie entretien' },
								{ key:'fiche_familiale',            label:'Fiche familiale' },
								{ key:'fiche_individuelle',         label:'Fiche individuelle' }
							] as ff}
								<div>
									<label class="label text-xs">{ff.label} (FCFA)</label>
									<input type="number" bind:value={globalEdit.frais_fixes[ff.key]} class="input-field text-sm" />
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- ── Traitement & délais ──────────────────────────── -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
					<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">⏱️ Traitement & délais</h2>
					<div class="grid sm:grid-cols-2 gap-4">
						{#each [
							{ key:'sla_heures_defaut',                    label:'SLA par défaut (heures)' },
							{ key:'delai_declaration_naissance_jours',    label:'Délai déclaration naissance (jours)' },
							{ key:'delai_declaration_deces_jours',        label:'Délai déclaration décès (jours)' },
							{ key:'max_pieces_jointes',                   label:'Nb max pièces jointes' }
						] as f}
							{@const locked = lockedParams.includes(f.key)}
							<div>
								<label class="label text-xs flex items-center gap-1">{f.label}{#if locked}<span class="text-red-500">🔒</span>{/if}</label>
								<input type="number" bind:value={globalEdit[f.key]} disabled={locked}
									class="input-field text-sm {locked ? 'bg-gray-50 opacity-60' : ''}" />
							</div>
						{/each}
					</div>
				</div>

				<!-- ── Notifications globales ────────────────────────── -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
					<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">🔔 Notifications & intégrations</h2>
					{#each [
						{ key:'whatsapp_actif',                      label:'Livraison WhatsApp activée',            desc:'Les actes sont envoyés par WhatsApp au citoyen.' },
						{ key:'notif_agent_nouvelle_demande',        label:'Notif agents : nouvelle demande',        desc:'Les agents reçoivent une notification à chaque nouvelle demande.' },
						{ key:'notif_agent_escalade_resolue',        label:'Notif agents : escalade résolue',        desc:'Les agents sont notifiés quand leur escalade est résolue.' },
						{ key:'notif_agent_reassignation',           label:'Notif agents : réassignation',           desc:'Les agents sont notifiés quand un dossier leur est réassigné.' },
						{ key:'notif_superviseur_nouvelle_escalade', label:'Notif superviseur : nouvelle escalade',  desc:'Le superviseur est notifié à chaque escalade créée.' },
						{ key:'notif_maire_cas_critique',            label:'Notif maire : cas critique (SLA)',        desc:'Le maire est notifié lorsqu\'une demande dépasse le SLA.' }
					] as opt}
						{@const locked = lockedParams.includes(opt.key)}
						<div class="flex items-center justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
							<div class="flex-1">
								<p class="text-sm font-medium text-gray-800 flex items-center gap-1">{opt.label}{#if locked}<span class="text-xs text-red-500">🔒</span>{/if}</p>
								<p class="text-xs text-gray-400">{opt.desc}</p>
							</div>
							<button on:click={() => !locked && (globalEdit[opt.key] = !globalEdit[opt.key])}
								class="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0
									{globalEdit[opt.key] ? 'bg-primary-500' : 'bg-gray-300'}
									{locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
								<span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 {globalEdit[opt.key] ? 'left-5' : 'left-0.5'}"></span>
							</button>
						</div>
					{/each}
				</div>

				<!-- ── Paramètres système ────────────────────────────── -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
					<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">🖥️ Paramètres système</h2>
					<div class="grid sm:grid-cols-2 gap-4">
						<div>
							<label class="label text-xs">Langue de l'interface</label>
							<select bind:value={globalEdit.langue} class="input-field text-sm">
								<option value="fr">Français</option>
								<option value="en">English</option>
							</select>
						</div>
						<div>
							<label class="label text-xs">Fuseau horaire</label>
							<select bind:value={globalEdit.timezone} class="input-field text-sm">
								<option value="Africa/Abidjan">Africa/Abidjan (GMT+0)</option>
								<option value="Africa/Dakar">Africa/Dakar (GMT+0)</option>
								<option value="Africa/Lagos">Africa/Lagos (GMT+1)</option>
								<option value="Europe/Paris">Europe/Paris (GMT+1/2)</option>
							</select>
						</div>
						<div>
							<label class="label text-xs">Format de date</label>
							<select bind:value={globalEdit.format_date} class="input-field text-sm">
								<option value="dd/mm/yyyy">JJ/MM/AAAA</option>
								<option value="mm/dd/yyyy">MM/JJ/AAAA</option>
								<option value="yyyy-mm-dd">AAAA-MM-JJ (ISO)</option>
							</select>
						</div>
						<div>
							{#each [lockedParams.includes('securite_session_heures')] as locked}
								<label class="label text-xs flex items-center gap-1">Durée de session (heures){#if locked}<span class="text-red-500">🔒</span>{/if}</label>
								<input type="number" min="1" max="72" bind:value={globalEdit.securite_session_heures} disabled={locked}
									class="input-field text-sm {locked ? 'bg-gray-50 opacity-60' : ''}" />
							{/each}
						</div>
					</div>
				</div>

				<!-- ── Paramètres lumière / interface ───────────────── -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
					<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">🌓 Paramètres lumière & interface</h2>
					<div class="grid sm:grid-cols-2 gap-4">
						<div>
							{#each [lockedParams.includes('theme')] as locked}
								<label class="label text-xs flex items-center gap-1">Thème de l'interface{#if locked}<span class="text-red-500">🔒</span>{/if}</label>
								<select bind:value={globalEdit.theme} disabled={locked}
									class="input-field text-sm {locked ? 'bg-gray-50 opacity-60' : ''}">
									<option value="light">☀️ Clair</option>
									<option value="dark">🌙 Sombre</option>
									<option value="auto">🖥️ Automatique (système)</option>
								</select>
							{/each}
						</div>
						<div>
							{#each [lockedParams.includes('taille_police')] as locked}
								<label class="label text-xs flex items-center gap-1">Taille de police{#if locked}<span class="text-red-500">🔒</span>{/if}</label>
								<select bind:value={globalEdit.taille_police} disabled={locked}
									class="input-field text-sm {locked ? 'bg-gray-50 opacity-60' : ''}">
									<option value="small">Petite</option>
									<option value="normal">Normale</option>
									<option value="large">Grande</option>
									<option value="xlarge">Très grande</option>
								</select>
							{/each}
						</div>
					</div>
					<div class="flex items-center justify-between gap-4 pt-2">
						<div>
							<p class="text-sm font-medium text-gray-800">Animations de l'interface</p>
							<p class="text-xs text-gray-400">Transitions, fondus et effets visuels.</p>
						</div>
						<button on:click={() => globalEdit.animations = !globalEdit.animations}
							class="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 cursor-pointer
								{globalEdit.animations ? 'bg-primary-500' : 'bg-gray-300'}">
							<span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 {globalEdit.animations ? 'left-5' : 'left-0.5'}"></span>
						</button>
					</div>
				</div>

				<!-- Bouton global save -->
				<button on:click={saveGlobalParams} disabled={saving}
					class="btn-primary text-sm w-full sm:w-auto">
					{saving ? 'Enregistrement…' : '💾 Enregistrer tous les paramètres globaux'}
				</button>

				<!-- ── Paramètres Rendez-vous ────────────────────────── -->
				{#if settings.global?.modules?.rdv}
				<div class="bg-white rounded-2xl border border-primary-100 p-6 space-y-4">
					<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">📅 Paramètres Rendez-vous</h2>
					<p class="text-xs text-gray-400">Configurez les horaires et les créneaux de retrait en mairie.</p>

					<div class="grid sm:grid-cols-2 gap-4">
						<div>
							<label class="label text-xs">Heure d'ouverture</label>
							<input type="time" bind:value={globalEdit.rdv_heure_debut} class="input-field text-sm"
								placeholder="08:00" />
						</div>
						<div>
							<label class="label text-xs">Heure de fermeture</label>
							<input type="time" bind:value={globalEdit.rdv_heure_fin} class="input-field text-sm"
								placeholder="16:00" />
						</div>
						<div>
							<label class="label text-xs">Durée d'un créneau (minutes)</label>
							<select bind:value={globalEdit.rdv_duree_creneau} class="input-field text-sm">
								<option value={15}>15 min</option>
								<option value={20}>20 min</option>
								<option value={30}>30 min</option>
								<option value={45}>45 min</option>
								<option value={60}>1h</option>
							</select>
						</div>
						<div>
							<label class="label text-xs">RDV max par créneau</label>
							<input type="number" min="1" max="20" bind:value={globalEdit.rdv_max_par_creneau} class="input-field text-sm" />
						</div>
						<div>
							<label class="label text-xs">Délai min avant RDV (jours)</label>
							<input type="number" min="0" max="30" bind:value={globalEdit.rdv_delai_min_jours} class="input-field text-sm" />
						</div>
						<div>
							<label class="label text-xs">Horizon max (jours depuis aujourd'hui)</label>
							<input type="number" min="7" max="90" bind:value={globalEdit.rdv_delai_max_jours} class="input-field text-sm" />
						</div>
						<div class="sm:col-span-2">
							<label class="label text-xs">Lieu affiché au citoyen</label>
							<input type="text" bind:value={globalEdit.rdv_lieu} class="input-field text-sm"
								placeholder="Mairie de Cocody – Guichet 3" />
						</div>
					</div>

					<!-- Jours ouvrables -->
					<div>
						<label class="label text-xs mb-2">Jours ouvrables</label>
						<div class="flex gap-2 flex-wrap">
							{#each [{d:1,l:'Lun'},{d:2,l:'Mar'},{d:3,l:'Mer'},{d:4,l:'Jeu'},{d:5,l:'Ven'},{d:6,l:'Sam'}] as j}
								{@const actif = (globalEdit.rdv_jours_ouvrables || [1,2,3,4,5]).includes(j.d)}
								<button on:click={() => {
									const cur = globalEdit.rdv_jours_ouvrables || [1,2,3,4,5];
									globalEdit.rdv_jours_ouvrables = actif ? cur.filter(x => x !== j.d) : [...cur, j.d].sort();
								}}
									class="px-3 py-1.5 rounded-xl border-2 text-sm font-medium transition-all
										{actif ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}">
									{j.l}
								</button>
							{/each}
						</div>
					</div>

					<button on:click={saveRdvSettings} disabled={saving}
						class="btn-primary text-sm">
						{saving ? 'Enregistrement…' : '💾 Enregistrer les paramètres RDV'}
					</button>
				</div>
				{/if}

				<!-- ── Paramètres agent ──────────────────────────────── -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
					<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">👩‍💼 Paramètres agent</h2>

					<!-- SLA -->
					<div>
						<label class="label text-xs flex items-center gap-1">SLA alerte (heures){#if lockedParams.includes('sla_heures')}<span class="text-red-500">🔒 non modifiable par les agents</span>{/if}</label>
						<div class="flex items-center gap-3 flex-wrap">
							{#each [24, 48, 72, 96] as h}
								<button on:click={() => !lockedParams.includes('sla_heures') && saveRoleSettings('agent', { sla_heures: h })}
									class="px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all
										{settings.agent?.sla_heures === h ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}
										{lockedParams.includes('sla_heures') ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-300'}"
								>{h}h</button>
							{/each}
						</div>
					</div>

					<!-- Notifications agent -->
					<div class="pt-4 border-t border-gray-100 space-y-2">
						<h3 class="text-sm font-semibold text-gray-600">Préférences de notification (agents)</h3>
						{#each [
							{ key:'nouvelle_demande', label:'Nouvelle demande',  lockKey:'notif_agent_nouvelle_demande', desc:'Notifié à chaque nouvelle demande assignée.' },
							{ key:'escalade_resolue', label:'Escalade résolue',  lockKey:'notif_agent_escalade_resolue', desc:'Notifié quand une de ses escalades est résolue.' },
							{ key:'reassignation',   label:'Réassignation',     lockKey:'notif_agent_reassignation',    desc:'Notifié quand un dossier lui est réassigné.' }
						] as notif}
							{@const locked = lockedParams.includes(notif.lockKey)}
							<div class="flex items-center justify-between gap-4 py-1.5">
								<div class="flex-1">
									<p class="text-sm text-gray-800 flex items-center gap-1">{notif.label}{#if locked}<span class="text-xs text-red-500">🔒</span>{/if}</p>
									<p class="text-xs text-gray-400">{notif.desc}</p>
								</div>
								<button on:click={() => !locked && (agentNotifs[notif.key] = !agentNotifs[notif.key])}
									class="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0
										{agentNotifs[notif.key] ? 'bg-primary-500' : 'bg-gray-300'}
										{locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
									<span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 {agentNotifs[notif.key] ? 'left-5' : 'left-0.5'}"></span>
								</button>
							</div>
						{/each}
						<button on:click={saveAgentNotifs} disabled={savingRole === 'agent'} class="btn-secondary text-xs mt-2">
							{savingRole === 'agent' ? 'Enregistrement…' : 'Enregistrer notifications agent'}
						</button>
					</div>
				</div>

				<!-- ── Paramètres superviseur ────────────────────────── -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
					<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">👔 Paramètres superviseur</h2>

					<!-- Seuil escalades -->
					<div>
						<label class="label text-xs flex items-center gap-1">Seuil alerte escalades{#if lockedParams.includes('seuil_escalades_alerte')}<span class="text-red-500">🔒</span>{/if}</label>
						<div class="flex items-center gap-3 flex-wrap">
							{#each [1, 3, 5, 10] as s}
								<button on:click={() => !lockedParams.includes('seuil_escalades_alerte') && saveRoleSettings('superviseur', { seuil_escalades_alerte: s })}
									class="px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all
										{settings.superviseur?.seuil_escalades_alerte === s ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600'}
										{lockedParams.includes('seuil_escalades_alerte') ? 'opacity-50 cursor-not-allowed' : 'hover:border-violet-300'}"
								>{s}</button>
							{/each}
						</div>
					</div>

					<!-- Notifications superviseur -->
					<div class="pt-4 border-t border-gray-100 space-y-2">
						<h3 class="text-sm font-semibold text-gray-600">Préférences de notification (superviseur)</h3>
						<div class="flex items-center justify-between gap-4 py-1.5">
							<div class="flex-1">
								<p class="text-sm text-gray-800 flex items-center gap-1">Nouvelle escalade{#if lockedParams.includes('notif_superviseur_nouvelle_escalade')}<span class="text-xs text-red-500">🔒</span>{/if}</p>
								<p class="text-xs text-gray-400">Notifié à chaque escalade créée par un agent.</p>
							</div>
							<button on:click={() => !lockedParams.includes('notif_superviseur_nouvelle_escalade') && (supNotifs.nouvelle_escalade = !supNotifs.nouvelle_escalade)}
								class="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0
									{supNotifs.nouvelle_escalade ? 'bg-primary-500' : 'bg-gray-300'}
									{lockedParams.includes('notif_superviseur_nouvelle_escalade') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
								<span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 {supNotifs.nouvelle_escalade ? 'left-5' : 'left-0.5'}"></span>
							</button>
						</div>
						<button on:click={saveSupNotifs} disabled={savingRole === 'superviseur'} class="btn-secondary text-xs mt-2">
							{savingRole === 'superviseur' ? 'Enregistrement…' : 'Enregistrer notifications superviseur'}
						</button>
					</div>
				</div>

				<!-- ── Paramètres maire ──────────────────────────────── -->
				<div class="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
					<h2 class="font-syne font-semibold text-gray-700 flex items-center gap-2">🏛️ Paramètres maire</h2>

					<!-- Période dashboard -->
					<div>
						<label class="label text-xs flex items-center gap-1">Période par défaut du dashboard{#if lockedParams.includes('periode_dashboard')}<span class="text-red-500">🔒</span>{/if}</label>
						<div class="flex gap-3 flex-wrap">
							{#each [{v:'semaine',l:'Semaine'},{v:'mois',l:'Mois'},{v:'trimestre',l:'Trimestre'},{v:'annee',l:'Année'}] as opt}
								<button on:click={() => !lockedParams.includes('periode_dashboard') && (maireEdit.periode_dashboard = opt.v)}
									class="px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all
										{maireEdit.periode_dashboard === opt.v ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}
										{lockedParams.includes('periode_dashboard') ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-300'}"
								>{opt.l}</button>
							{/each}
						</div>
					</div>

					<!-- Notifications maire -->
					<div class="pt-4 border-t border-gray-100 space-y-2">
						<h3 class="text-sm font-semibold text-gray-600">Préférences de notification (maire)</h3>
						<div class="flex items-center justify-between gap-4 py-1.5">
							<div class="flex-1">
								<p class="text-sm text-gray-800 flex items-center gap-1">Cas critique (SLA dépassé){#if lockedParams.includes('notif_maire_cas_critique')}<span class="text-xs text-red-500">🔒</span>{/if}</p>
								<p class="text-xs text-gray-400">Le maire est alerté lorsqu'une demande dépasse le délai SLA.</p>
							</div>
							<button on:click={() => !lockedParams.includes('notif_maire_cas_critique') && (maireEdit.cas_critique = !maireEdit.cas_critique)}
								class="relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0
									{maireEdit.cas_critique ? 'bg-primary-500' : 'bg-gray-300'}
									{lockedParams.includes('notif_maire_cas_critique') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
								<span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 {maireEdit.cas_critique ? 'left-5' : 'left-0.5'}"></span>
							</button>
						</div>
						<button on:click={saveMaireSettings} disabled={savingRole === 'maire'} class="btn-secondary text-xs mt-2">
							{savingRole === 'maire' ? 'Enregistrement…' : 'Enregistrer paramètres maire'}
						</button>
					</div>
				</div>

			</div>
		<!-- ── TAB: VERROUILLAGES ──────────────────────────────── -->
		{:else if activeTab === 'locks'}
			<div class="space-y-6">
				<div>
					<h1 class="font-syne font-bold text-2xl text-gray-800">Verrouillage des paramètres</h1>
					<p class="text-sm text-gray-500 mt-1">Un paramètre verrouillé ne peut plus être modifié par les agents, superviseurs ou le maire. Seul le Super Admin peut le changer.</p>
				</div>

				<div class="space-y-3">
					{#each LOCKABLE_PARAMS as param}
						{@const isLocked = lockedParams.includes(param.key)}
						<div class="bg-white rounded-xl border {isLocked ? 'border-red-200 bg-red-50/30' : 'border-gray-100'} p-4 flex items-center gap-4">
							<div class="text-2xl flex-shrink-0">{isLocked ? '🔒' : '🔓'}</div>
							<div class="flex-1">
								<p class="font-medium text-sm {isLocked ? 'text-red-800' : 'text-gray-800'}">{param.label}</p>
								<p class="text-xs text-gray-400">
									Rôle concerné : <span class="font-medium">{param.role}</span>
									· Clé : <span class="font-mono">{param.key}</span>
								</p>
							</div>
							<div class="flex items-center gap-3">
								{#if isLocked}
									<span class="text-xs bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded-full">Verrouillé</span>
								{:else}
									<span class="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">Libre</span>
								{/if}
								<button
									on:click={() => toggleLock(param.key)}
									class="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all
										{isLocked
											? 'border-primary-200 text-primary-600 hover:bg-primary-50'
											: 'border-red-200 text-red-600 hover:bg-red-50'}"
								>
									{isLocked ? '🔓 Déverrouiller' : '🔒 Verrouiller'}
								</button>
							</div>
						</div>
					{/each}
				</div>

				<div class="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
					<span class="text-lg flex-shrink-0">ℹ️</span>
					<div class="text-sm text-blue-800">
						<p class="font-semibold mb-1">Comment ça fonctionne ?</p>
						<p>Les paramètres verrouillés apparaissent en lecture seule dans les écrans de paramètres des autres profils. Seul le Super Admin peut les modifier depuis cet écran.</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- ── MODÈLES DE DOCUMENTS ── -->
		{#if activeTab === 'modeles'}
		<div class="space-y-4">
			<div class="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
				<svg class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
				<div class="text-sm text-blue-800">
					<p class="font-semibold mb-1">Modèles de documents officiels</p>
					<p>Chargez un modèle (DOCX, ODT, PDF) par type de service. Une fois le template chargé, la génération d'acte utilisera ce modèle comme base. Les variables <code class="bg-blue-100 px-1 rounded font-mono text-xs">&#123;&#123;nom&#125;&#125;</code>, <code class="bg-blue-100 px-1 rounded font-mono text-xs">&#123;&#123;numero_acte&#125;&#125;</code> etc. seront automatiquement remplacées.</p>
				</div>
			</div>

			{#if templatesLoading}
				<div class="flex items-center justify-center py-16 text-gray-400">
					<svg class="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
					Chargement...
				</div>
			{:else}
				<div class="grid sm:grid-cols-2 gap-3">
					{#each templates as tpl}
						<div class="bg-white rounded-2xl border {tpl.configured ? 'border-primary-200' : 'border-gray-200'} p-4 shadow-sm">
							<div class="flex items-start justify-between mb-3">
								<div class="flex-1 min-w-0">
									<p class="font-semibold text-gray-800 text-sm truncate">{tpl.label}</p>
									{#if tpl.configured}
										<p class="text-xs text-gray-500 truncate mt-0.5">📄 {tpl.nom_fichier}</p>
										<p class="text-xs text-gray-400 mt-0.5">
											Chargé le {new Date(tpl.uploaded_at).toLocaleDateString('fr-FR')}
										</p>
									{:else}
										<p class="text-xs text-gray-400 mt-0.5 italic">Aucun modèle configuré</p>
									{/if}
								</div>
								{#if tpl.configured}
									<span class="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs ml-2">✓</span>
								{:else}
									<span class="flex-shrink-0 w-6 h-6 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center text-xs ml-2">—</span>
								{/if}
							</div>

							{#if templateToasts[tpl.key] === 'ok'}
								<p class="text-xs text-primary-600 font-medium mb-2 flex items-center gap-1">
									<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
									Modèle chargé avec succès
								</p>
							{/if}

							<div class="flex gap-2">
								<label class="flex-1 cursor-pointer">
									<input
										type="file"
										accept=".docx,.odt,.pdf,.doc"
										class="hidden"
										disabled={uploadingType === tpl.key}
										on:change={(e) => handleTemplateUpload(tpl.key, e)}
									/>
									<span class="w-full flex items-center justify-center gap-1.5 text-xs font-semibold border-2 {tpl.configured ? 'border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-600' : 'border-primary-300 text-primary-700 hover:border-primary-500'} rounded-xl py-2 px-3 transition-colors cursor-pointer {uploadingType === tpl.key ? 'opacity-50' : ''}">
										{#if uploadingType === tpl.key}
											<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
										{:else}
											<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
										{/if}
										{tpl.configured ? 'Remplacer' : 'Charger le modèle'}
									</span>
								</label>
								{#if tpl.configured}
									<button
										on:click={() => deleteTemplate(tpl.key)}
										class="flex-shrink-0 text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-xl py-2 px-2.5 transition-colors"
										title="Supprimer le modèle"
									>
										<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
		{/if}


		<!-- ── JOURNAL D'AUDIT ── -->
		{#if activeTab === 'journal'}
		<div class="space-y-4">
			<div class="flex flex-wrap gap-3 items-center">
				<input bind:value={auditFilter} type="search" placeholder="Rechercher dossier, agent, note…" class="bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-gray-300" />
				<select bind:value={auditTypeFilter} class="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
					<option value="">Tous les types</option>
					<option value="changement_statut">Changements de statut</option>
					<option value="note_interne">Notes internes</option>
					<option value="escalade">Escalades</option>
					<option value="remboursement">Remboursements</option>
				</select>
				{#if auditFilter || auditTypeFilter}
					<button on:click={() => { auditFilter = ''; auditTypeFilter = ''; }} class="text-xs text-gray-500 hover:text-gray-700 underline">Réinitialiser</button>
				{/if}
				<button on:click={loadAudit} class="ml-auto flex items-center gap-1.5 text-xs bg-white border border-gray-200 hover:border-gray-400 px-3 py-2 rounded-xl transition-colors">
					<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
					Actualiser
				</button>
				<span class="text-xs text-gray-400">{filteredAudit.length} entrée{filteredAudit.length > 1 ? 's' : ''}</span>
			</div>

			<div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
				{#if auditLoading}
					<div class="flex items-center justify-center py-16 text-gray-400">
						<svg class="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
						</svg>
						Chargement du journal…
					</div>
				{:else if filteredAudit.length === 0}
					<div class="text-center py-16 text-gray-400">
						<p class="text-4xl mb-3">📜</p>
						<p>Aucune entrée trouvée</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
								<tr>
									<th class="text-left px-4 py-3">Date & heure</th>
									<th class="text-left px-4 py-3">Dossier</th>
									<th class="text-left px-4 py-3">Action</th>
									<th class="text-left px-4 py-3 hidden md:table-cell">Rôle</th>
									<th class="text-left px-4 py-3">Par</th>
									<th class="text-left px-4 py-3">Détail</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-50">
								{#each filteredAudit as entry}
									<tr class="hover:bg-gray-50 transition-colors">
										<td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
											{new Date(entry.date).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
										</td>
										<td class="px-4 py-3">
											<span class="font-mono text-xs font-semibold text-gray-900">{entry.demande_id}</span>
											<p class="text-xs text-gray-400 mt-0.5">{entry.demandeur}</p>
										</td>
										<td class="px-4 py-3">
											<span class="text-xs font-medium px-2 py-0.5 rounded-full {AUDIT_COLORS[entry.action] || 'bg-gray-100 text-gray-600'}">
												{AUDIT_LABELS[entry.action] || entry.action}
											</span>
										</td>
										<td class="px-4 py-3 text-xs hidden md:table-cell">
											<span class="flex items-center gap-1 text-gray-600">
												{ROLE_ICONS[entry.role] || '👤'} {entry.role}
											</span>
										</td>
										<td class="px-4 py-3 text-xs text-gray-600">{entry.par}</td>
										<td class="px-4 py-3 text-xs text-gray-500 max-w-xs">
											{#if entry.statut && entry.action === 'changement_statut'}
												<span>→ <strong class="text-gray-700">{entry.statut}</strong></span>
											{/if}
											{#if entry.note}
												<span class="italic line-clamp-2">{entry.note}</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
		{/if}

		<!-- ── TAB: SÉCURITÉ ──────────────────────────────────── -->
		{#if activeTab === 'securite'}
		<div class="space-y-6">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="font-syne font-bold text-xl text-gray-800">Journal de sécurité</h2>
					<p class="text-sm text-gray-500 mt-0.5">Historique de toutes les actions sensibles : connexions, modifications, verrouillages…</p>
				</div>
				<div class="flex items-center gap-2">
					<button on:click={loadSecLog} class="px-3 py-1.5 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors flex items-center gap-1">
						🔄 Actualiser
					</button>
					{#if !secClearConfirm}
						<button on:click={() => secClearConfirm = true} class="px-3 py-1.5 text-xs rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-medium transition-colors flex items-center gap-1">
							🗑️ Effacer le journal
						</button>
					{:else}
						<span class="text-xs text-red-600 font-medium">Confirmer ?</span>
						<button on:click={clearSecLog} class="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-colors">Oui, effacer</button>
						<button on:click={() => secClearConfirm = false} class="px-3 py-1.5 text-xs rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition-colors">Annuler</button>
					{/if}
				</div>
			</div>

			<!-- Filtres -->
			<div class="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3">
				<input
					bind:value={secSearch}
					type="search"
					placeholder="Rechercher…"
					class="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300"
				/>
				<select bind:value={secTypeFilter} class="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300">
					<option value="">Tous les types</option>
					{#each Object.entries(SEC_TYPES) as [k, t]}
						<option value={k}>{t.label}</option>
					{/each}
				</select>
				<span class="text-xs text-gray-400 self-center">{filteredSecLog.length} entrée{filteredSecLog.length !== 1 ? 's' : ''}</span>
			</div>

			<!-- Tableau -->
			<div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
				{#if secLoading}
					<div class="flex items-center justify-center py-16 text-gray-400">
						<svg class="w-6 h-6 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
						</svg>
						Chargement…
					</div>
				{:else if filteredSecLog.length === 0}
					<div class="text-center py-20 text-gray-400">
						<p class="text-5xl mb-3">🛡️</p>
						<p class="font-medium">Aucune entrée dans le journal</p>
						<p class="text-sm mt-1">Les connexions, modifications et actions sensibles apparaîtront ici</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
								<tr>
									<th class="text-left px-4 py-3 w-36">Date & heure</th>
									<th class="text-left px-4 py-3">Type</th>
									<th class="text-left px-4 py-3">Acteur</th>
									<th class="text-left px-4 py-3">Détails</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-50">
								{#each filteredSecLog as entry}
									<tr class="hover:bg-gray-50 transition-colors">
										<td class="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
											{new Date(entry.date).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' })}
										</td>
										<td class="px-4 py-3">
											<span class="text-xs font-medium px-2 py-0.5 rounded-full {SEC_TYPES[entry.type]?.color || 'bg-gray-100 text-gray-600'}">
												{SEC_TYPES[entry.type]?.label || entry.type}
											</span>
										</td>
										<td class="px-4 py-3">
											<span class="flex items-center gap-1 text-xs font-medium text-gray-700">
												{SEC_ACTEUR_ICONS[entry.acteur] || '👤'} {entry.acteur}
											</span>
										</td>
										<td class="px-4 py-3 text-xs text-gray-500 max-w-sm">
											{#if entry.type === 'connexion' || entry.type === 'deconnexion'}
												<span class="text-gray-600">{entry.type === 'connexion' ? '→ Accès au backoffice' : '← Déconnexion'}</span>
											{:else if entry.type === 'module_toggle'}
												<span>Module <strong class="text-gray-700">{entry.details?.module}</strong> : {entry.details?.enabled ? '✅ activé' : '❌ désactivé'}</span>
											{:else if entry.type === 'param_lock' || entry.type === 'param_unlock'}
												<span>Param <code class="bg-gray-100 px-1 rounded">{entry.details?.param}</code></span>
											{:else if entry.type === 'user_add'}
												<span>Ajout <strong class="text-gray-700">{entry.details?.nom}</strong> ({entry.details?.role}) — {entry.details?.email}</span>
											{:else if entry.type === 'user_toggle'}
												<span><strong class="text-gray-700">{entry.details?.nom}</strong> → {entry.details?.actif ? '✅ activé' : '⏸️ désactivé'}</span>
											{:else if entry.type === 'user_update'}
												<span>Modif <code class="bg-gray-100 px-1 rounded">{entry.details?.userId}</code> — champs : {(entry.details?.champs || []).join(', ')}</span>
											{:else if entry.type === 'settings_change' || entry.type === 'role_settings_change'}
												<span>{entry.details?.role ? `[${entry.details.role}] ` : ''}Champs : {(entry.details?.champs || []).join(', ')}</span>
											{:else if entry.type === 'template_upload'}
												<span>📄 {entry.details?.nom_fichier} — {entry.details?.type_acte}</span>
											{:else if entry.type === 'template_delete'}
												<span>🗑️ {entry.details?.nom_fichier || entry.details?.type_acte}</span>
											{:else if entry.type === 'identite_change'}
												<span>Champs : {(entry.details?.champs || []).join(', ')}</span>
											{:else if entry.type === 'statut_change'}
												<span>
													Dossier <strong class="font-mono text-gray-700">{entry.details?.demande_id}</strong>
													: <span class="line-through text-gray-400">{entry.details?.ancien_statut}</span>
													→ <strong class="text-gray-700">{entry.details?.nouveau_statut}</strong>
												</span>
											{:else if entry.type === 'acte_valide'}
												<span>
													Dossier <strong class="font-mono text-gray-700">{entry.details?.demande_id}</strong>
													({entry.details?.type_acte}) — N°{entry.details?.numero_acte}
													{#if entry.details?.officier_nom}, signé {entry.details.officier_nom}{/if}
												</span>
											{:else if entry.type === 'escalade_ajout'}
												<span>
													Dossier <strong class="font-mono text-gray-700">{entry.details?.demande_id}</strong>
													→ niveau <strong>{entry.details?.level}</strong>
													{#if entry.details?.motif} : {entry.details.motif}{/if}
												</span>
											{:else if entry.type === 'escalade_resolue'}
												<span>Dossier <strong class="font-mono text-gray-700">{entry.details?.demande_id}</strong> — escalade clôturée</span>
											{:else if entry.type === 'reassignation'}
												<span>Dossier <strong class="font-mono text-gray-700">{entry.details?.demande_id}</strong> → {entry.details?.agent_nom}</span>
											{:else if entry.type === 'paiement_valide'}
												<span>Dossier <strong class="font-mono text-gray-700">{entry.details?.demande_id}</strong> — {entry.details?.montant?.toLocaleString('fr-FR')} FCFA encaissé en mairie</span>
											{:else if entry.type === 'remboursement_initie'}
												<span>Dossier <strong class="font-mono text-gray-700">{entry.details?.demande_id}</strong> — {entry.details?.montant?.toLocaleString('fr-FR')} FCFA à rembourser</span>
											{:else if entry.type === 'remboursement_valide'}
												<span>Dossier <strong class="font-mono text-gray-700">{entry.details?.demande_id}</strong> — {entry.details?.montant?.toLocaleString('fr-FR')} FCFA remboursé{entry.details?.reference ? ` (réf. ${entry.details.reference})` : ''}</span>
											{:else if entry.type === 'note_interne'}
												<span>Dossier <strong class="font-mono text-gray-700">{entry.details?.demande_id}</strong> — note ajoutée</span>
											{:else}
												<span class="text-gray-400 font-mono text-xs">{JSON.stringify(entry.details)}</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!-- Légende des types -->
			<div class="bg-white rounded-2xl border border-gray-100 p-5">
				<h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Légende des événements</h3>
				<div class="flex flex-wrap gap-2">
					{#each Object.entries(SEC_TYPES) as [k, t]}
						<span class="text-xs px-2 py-1 rounded-full font-medium {t.color}">{t.label}</span>
					{/each}
				</div>
			</div>
		</div>
		{/if}

		{/if}
	</div>
</div>

<!-- Modal mot de passe temporaire -->
{#if showPasswordModal}
<div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
	<div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
				<svg class="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
				</svg>
			</div>
			<div>
				<h2 class="font-syne font-semibold text-gray-800">Compte créé avec succès</h2>
				<p class="text-xs text-gray-500">Communiquez ce mot de passe temporaire à l'utilisateur</p>
			</div>
		</div>
		<div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
			<p class="text-xs text-amber-700 font-medium mb-2">Mot de passe temporaire</p>
			<p class="font-mono text-lg font-bold text-amber-900 tracking-wider">{createdUserPassword}</p>
			<p class="text-xs text-amber-600 mt-2">L'utilisateur devra le changer depuis ses paramètres après connexion.</p>
		</div>
		<button
			on:click={() => showPasswordModal = false}
			class="btn-primary w-full"
		>
			J'ai noté le mot de passe
		</button>
	</div>
</div>
{/if}
