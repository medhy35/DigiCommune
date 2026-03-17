import { writable, derived } from 'svelte/store';

export const globalSettings = writable({});

/** true si le module donné est actif */
export const modules = derived(globalSettings, ($s) => $s.modules || {});

/** true si la livraison WhatsApp est activée */
export const whatsappActif = derived(globalSettings, ($s) => $s.whatsapp_actif !== false);

/** SLA en heures (défaut 48) */
export const slaHeures = derived(globalSettings, ($s) => $s.sla_heures_defaut ?? 48);

/** Frais par copie en FCFA (défaut 500) */
export const fraisCopie = derived(globalSettings, ($s) => $s.frais_copie ?? 500);
