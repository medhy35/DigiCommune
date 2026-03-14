import { writable } from 'svelte/store';

export const toasts = writable([]);

export function toast(message, type = 'success', duration = 3500) {
	const id = Math.random().toString(36).slice(2);
	toasts.update(t => [...t, { id, message, type }]);
	setTimeout(() => {
		toasts.update(t => t.filter(n => n.id !== id));
	}, duration);
}
