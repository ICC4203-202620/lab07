import { useCallback, useEffect, useState } from 'react';

/*
 * Estado de la conexión del navegador, con tres valores:
 *
 *   'offline'      no hay red
 *   'reconnected'  la red acaba de volver, y todavía no se le avisó al usuario
 *   'online'       operación normal
 *
 * El valor 'reconnected' existe para poder mostrar el aviso de recuperación una
 * sola vez; se consume llamando a acknowledge().
 *
 * Advertencia sobre navigator.onLine: solo informa si el equipo tiene una
 * interfaz de red activa. Puede decir true estando conectado a un router sin
 * salida a Internet. Sirve para el aviso en pantalla, pero la decisión de usar
 * la información guardada no se toma con esto, sino cuando una petición a la
 * API falla de verdad (ver Weather.jsx).
 */
export default function useConnectionStatus() {
  const [status, setStatus] = useState(() => (navigator.onLine ? 'online' : 'offline'));

  useEffect(() => {
    const goOffline = () => setStatus('offline');
    const goOnline = () => setStatus('reconnected');

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  const acknowledge = useCallback(() => setStatus('online'), []);

  return [status, acknowledge];
}
