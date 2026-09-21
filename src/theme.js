import { createTheme } from '@mui/material/styles';

/*
 * El color de la aplicación vive en tres archivos, y los tres tienen que decir
 * lo mismo:
 *
 *   src/theme.js               lo que pinta React mientras la app está abierta
 *   index.html (theme-color)   la interfaz del navegador alrededor de la página
 *   public/manifest.webmanifest  la app instalada: barra de estado y splash
 *
 * Si se cambia solo el primero, la aplicación instalada abre con una franja del
 * color antiguo arriba y una pantalla de carga que no combina. El manifiesto
 * solo se relee cuando el navegador lo vuelve a buscar, así que para ver el
 * cambio hay que reinstalar la PWA.
 */

// Azul profundo. Sobre blanco da una razón de contraste de 5.6:1, por encima
// del 4.5:1 que pide WCAG AA para texto normal; el #569de3 anterior llegaba a
// 2.8:1, y el título de la AppBar quedaba al límite de lo legible.
const PRIMARY = '#1b6ca8';
const SECONDARY = '#b45309';   // ámbar oscuro, 5.0:1 sobre blanco
const SURFACE = '#f4f7fa';     // fondo de la página, apenas azulado

const theme = createTheme({
  typography: {
    fontFamily: [
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif'
    ].join(','), // Definiendo Roboto como la fuente principal
    },
  palette: {
    primary: {
      main: PRIMARY,
    },
    secondary: {
      main: SECONDARY,
    },
    error: {
      main: '#c62828',
    },
    background: {
      // `default` es el fondo de la página y `paper` el de las superficies que
      // se apoyan encima (Card, Menu, Dialog). Antes estaban al revés —página
      // blanca, tarjetas grises—, de modo que las tarjetas se hundían en vez de
      // levantarse. Ojo: `default` solo se aplica si la aplicación monta
      // CssBaseline, cosa que ahora hace main.jsx.
      default: SURFACE,
      paper: '#ffffff',
    },
    text: {
      primary: '#1f2933',  // Color para texto principal
      secondary: '#52606d',  // Color para texto secundario
      link: '#1b6ca8',  // Puedes agregar esto para links
    },
  },
  components: {
    // Para botones específicos puedes hacer ajustes aquí
    MuiButton: {
      styleOverrides: {
        root: {
          // Aplica estilos adicionales aquí si es necesario
          fontWeight: 'bold',
        },
      },
    },
    // Ajustes para AppBar, por ejemplo, la topbar
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: {
          color: '#ffffff',  // Establece el color de la fuente a blanco
          backgroundColor: PRIMARY,  // Mismo color declarado arriba, no un duplicado a mano
        },
      },
    },
  },
});

export default theme;
