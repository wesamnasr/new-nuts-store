/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)',
        },
        pistachio: {
          50: 'rgb(var(--pistachio-50) / <alpha-value>)',
          100: 'rgb(var(--pistachio-100) / <alpha-value>)',
          500: 'rgb(var(--pistachio-500) / <alpha-value>)',
          600: 'rgb(var(--pistachio-600) / <alpha-value>)',
          700: 'rgb(var(--pistachio-700) / <alpha-value>)',
        },
        gold: {
          400: 'rgb(var(--gold-400) / <alpha-value>)',
          500: 'rgb(var(--gold-500) / <alpha-value>)',
          600: 'rgb(var(--gold-600) / <alpha-value>)',
        },
        hafsa: {
          ivory: '#FAF6F0',     // Warm Calacatta Ivory (Primary BG)
          cream: '#F3ECE1',     // Soft Almond Cream (Surface / Cards)
          espresso: '#231710',  // Deep Espresso Roast (Primary Brand)
          oak: '#C88A4B',       // Warm Honey Oak (Secondary Warm)
          gold: '#D4AF37',      // Champagne Backlit Gold (Accent / Gold CTA)
          pistachio: '#3B6E4C', // Pistachio Green (Success / Fresh)
          cherry: '#B83B2B',    // Coffee Cherry Red (Promo / Urgency)
        },
      },
      fontFamily: {
        cairo: ['var(--font-cairo)', 'sans-serif'],
        tajawal: ['var(--font-tajawal)', 'var(--font-cairo)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
