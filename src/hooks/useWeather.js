import { useEffect, useState } from 'react';
import fetchWeather, { NetworkError } from '../api/weatherApi';
import { loadWeather, saveWeather } from '../api/weatherCache';
import useConnectionStatus from './useConnectionStatus';

/*
 * Todo lo necesario para mostrar el clima de una ciudad: la consulta a la API,
 * el respaldo en localStorage, y la reacción a los cambios de conexión.
 *
 * Devuelve un objeto y no un arreglo, al revés que useConnectionStatus. La
 * convención del arreglo (la de useState) conviene cuando son dos valores y
 * quien llama quiere ponerles nombre; con cuatro campos de nombre fijo, el
 * objeto se lee mejor y permite agregar uno más sin romper a nadie.
 *
 * Fíjate en que este hook llama a otro hook, useConnectionStatus. Los hooks se
 * componen entre sí igual que las funciones normales: el que está más arriba no
 * necesita saber que abajo hay un par de addEventListener sobre window.
 */
export default function useWeather(location) {
  const [weather, setWeather] = useState(null);   // datos del clima
  const [savedAt, setSavedAt] = useState(null);   // hora de la lectura, si viene del caché
  const [loading, setLoading] = useState(true);   // estado de carga
  const [error, setError] = useState('');         // mensaje de error
  const [status] = useConnectionStatus();

  // El efecto se vuelve a ejecutar cuando la conexión cae y cuando vuelve, de
  // modo que al recuperar la red la lectura guardada se reemplaza sola por una
  // consulta nueva a la API.
  const disconnected = status === 'offline';

  useEffect(() => {
    // React apaga esta bandera en el return de abajo, y ejecuta esa limpieza
    // antes de volver a correr el efecto. Así, si la conexión cambia mientras
    // una petición está en vuelo, la respuesta que llegue tarde no pisa el
    // estado que dejó la ejecución más reciente: solo la vigente escribe.
    let current = true;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const temps = await fetchWeather(location);

        if (!current) return;

        if (temps) {
          saveWeather(location, temps);
          setWeather(temps);
          setSavedAt(null);
        } else {
          setError('No se pudo cargar el clima.');
        }
      } catch (e) {
        if (!current) return;

        // Falló la red. Si hay una lectura guardada para esta ciudad la
        // mostramos, señalando de cuándo es; si no hay nada, solo queda avisar.
        const cached = e instanceof NetworkError ? loadWeather(location) : null;

        if (cached) {
          setWeather(cached.weather);
          setSavedAt(cached.savedAt);
        } else if (e instanceof NetworkError) {
          setError('Sin conexión, y no hay información guardada de esta ciudad.');
        } else {
          setError('No se pudo cargar el clima.');
        }
      } finally {
        if (current) setLoading(false);
      }
    })();

    return () => { current = false; };
  }, [location, disconnected]);

  return { weather, savedAt, loading, error };
}
