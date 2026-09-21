// Registro del service worker (public/sw.js).
//
// Solo se registra en la aplicación construida. En `yarn dev`, Vite sirve cada
// módulo por separado y un caché en el medio dejaría al navegador con versiones
// viejas del código, rompiendo la recarga en caliente. Para probar el
// comportamiento sin conexión hay que usar `yarn build && yarn preview`.
export default function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  // Esperamos el load para no competir por ancho de banda con los archivos que
  // la página necesita para mostrarse.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('No se pudo registrar el service worker:', err);
    });
  });
}
