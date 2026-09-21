import { Box, Typography, CircularProgress } from '@mui/material';
import { formatSavedAt } from '../api/weatherCache';
import useWeather from '../hooks/useWeather';
import useNow from '../hooks/useNow';
import PropTypes from 'prop-types';

// Cada cuánto se recalcula el texto "hace N minutos" cuando hay una lectura
// guardada en pantalla.
const TICK = 30000;

const Weather = ({ location = 'Santiago de Chile' }) => {
  const { weather, savedAt, loading, error } = useWeather(location);

  // El hook se llama siempre —las reglas de los hooks no admiten llamarlo
  // dentro de un if—, pero con intervalo 0 no arma ningún temporizador. Sin
  // fecha que mostrar no hay nada que refrescar.
  const now = useNow(savedAt === null ? 0 : TICK);

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
          Última actualización: {formatSavedAt(savedAt, now)}.
        </Typography>
      )}
    </Box>
  );
};

Weather.propTypes = {
  location: PropTypes.string,
};

export default Weather;
