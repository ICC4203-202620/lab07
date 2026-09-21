import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme'; // Asegúrate de importar el tema
import registerServiceWorker from './registerServiceWorker';

// Convierte la aplicación en una PWA: deja el service worker a cargo de los
// archivos para que la aplicación pueda abrirse sin conexión.
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        {/* Normaliza los estilos del navegador y aplica palette.background.default
            al <body>. Sin CssBaseline el fondo del theme no se usa nunca. */}
        <CssBaseline />
        <App />
        </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);