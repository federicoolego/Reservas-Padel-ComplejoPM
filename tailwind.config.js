/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de Complejo PM: blanco y negro como el logo (los nombres se mantienen para no tocar los componentes)
        noche: '#141414',     // negro: encabezados y textos
        escudo: '#2E2E2E',    // gris carbón: botones y acentos
        pelota: '#D2DA1F',    // amarillo de la pelota
        rojo: '#D7262E',      // rojo -> turno reservado
        cesped: '#1F7A3A',    // verde -> turno libre
        niebla: '#F4F4F2',
        tinta: '#5F5F5F',
        linea: '#DCDCD8',
      },
      fontFamily: {
        tablero: ['"Barlow Condensed"', '"Arial Narrow"', 'sans-serif'],
        sans: ['Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
