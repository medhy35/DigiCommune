/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				primary: {
					50: '#e6f5ee',
					100: '#c2e5d0',
					200: '#9dd4b2',
					300: '#6fbe8e',
					400: '#3dab72',
					500: '#009A44',
					600: '#00883c',
					700: '#007433',
					800: '#005f2a',
					900: '#004a21'
				},
				accent: {
					50: '#fff0e6',
					100: '#ffd6b3',
					200: '#ffb980',
					300: '#ff9a4d',
					400: '#ff801f',
					500: '#FF6B00',
					600: '#e05f00',
					700: '#c25200',
					800: '#a04400',
					900: '#7d3500'
				}
			},
			fontFamily: {
				syne: ['Syne', 'sans-serif'],
				dm: ['DM Sans', 'sans-serif']
			},
			boxShadow: {
				card: '0 2px 16px 0 rgba(0,0,0,0.07)',
				'card-hover': '0 4px 24px 0 rgba(0,0,0,0.12)'
			}
		}
	},
	plugins: []
};
