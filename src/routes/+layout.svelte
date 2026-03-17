<script>
	import '../app.css';
	import Toast from '$lib/components/Toast.svelte';
	import { onMount } from 'svelte';
	import { commune } from '$lib/stores/commune.js';
	import { globalSettings } from '$lib/stores/settings.js';

	onMount(async () => {
		const [communeRes, settingsRes] = await Promise.all([
			fetch('/api/commune'),
			fetch('/api/settings?role=global')
		]);
		if (communeRes.ok) {
			const data = await communeRes.json();
			commune.set(data);
			applyTheme(data.couleur_primaire);
		}
		if (settingsRes.ok) {
			const data = await settingsRes.json();
			globalSettings.set(data.settings || {});
		}
	});

	function hexToRgb(hex) {
		const h = hex.replace('#', '');
		return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
	}

	function blend(hex, target, amount) {
		const [r1, g1, b1] = hexToRgb(hex);
		const r = Math.round(Math.max(0, Math.min(255, r1 + (target[0] - r1) * amount)));
		const g = Math.round(Math.max(0, Math.min(255, g1 + (target[1] - g1) * amount)));
		const b = Math.round(Math.max(0, Math.min(255, b1 + (target[2] - b1) * amount)));
		return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
	}

	function applyTheme(hex) {
		if (!hex || typeof document === 'undefined') return;
		const white = [255, 255, 255], black = [0, 0, 0];
		const root = document.documentElement;
		root.style.setProperty('--color-p50',  blend(hex, white, 0.92));
		root.style.setProperty('--color-p100', blend(hex, white, 0.82));
		root.style.setProperty('--color-p200', blend(hex, white, 0.64));
		root.style.setProperty('--color-p300', blend(hex, white, 0.44));
		root.style.setProperty('--color-p400', blend(hex, white, 0.22));
		root.style.setProperty('--color-p500', hex);
		root.style.setProperty('--color-p600', blend(hex, black, 0.10));
		root.style.setProperty('--color-p700', blend(hex, black, 0.22));
		root.style.setProperty('--color-p800', blend(hex, black, 0.38));
		root.style.setProperty('--color-p900', blend(hex, black, 0.52));
	}
</script>

<Toast />
<slot />
