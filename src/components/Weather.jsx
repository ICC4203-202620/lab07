import { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import fetchWeather, { NetworkError } from '../api/weatherApi';
import { loadWeather, saveWeather, formatSavedAt } from '../api/weatherCache';
import useConnectionStatus from '../hooks/useConnectionStatus';
import PropTypes from 'prop-types';

const Weather = ({ location = 'Santiago de Chile' }) => {
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={18} />
        <Typography variant="body2">Cargando clima…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Typography variant="body2" color="error">
        {error}
      </Typography>
    );
  }

  if (!weather) return null;

  const {
    temp,                 // actual
    tempMinForecast,      // mínima pronosticada hoy
    tempMaxForecast,      // máxima pronosticada hoy
    tempMinObserved,      // mínima observada hoy (fallback)
    tempMaxObserved,      // máxima observada hoy (fallback)
  } = weather;

  // Tomamos pronóstico si existe; si no, caemos a observada
  const maxToday = (tempMaxForecast ?? tempMaxObserved);
  const minToday = (tempMinForecast ?? tempMinObserved);

  const fmt = (v) => (v == null ? '—' : `${v} °C`);

  return (
    <Box>
      <Typography variant="body1"><strong>Actual:</strong> {fmt(temp)}</Typography>
      <Typography variant="body1"><strong>Máxima:</strong> {fmt(maxToday)}</Typography>
      <Typography variant="body1"><strong>Mínima:</strong> {fmt(minToday)}</Typography>

      {/* Solo cuando el dato viene del caché: el aviso de que no hay conexión
          lo da ConnectionStatus, y lo que falta acá es de cuándo es el dato. */}
      {savedAt !== null && (
        <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 1.5 }}>
          Última actualización: {formatSavedAt(savedAt)}.
        </Typography>
      )}
    </Box>
  );
};

Weather.propTypes = {
  location: PropTypes.string,
};

export default Weather;
