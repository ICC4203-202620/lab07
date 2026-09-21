import axios from 'axios';

/*
 * Error de conectividad: la petición nunca obtuvo respuesta de Open-Meteo.
 *
 * Se distingue de "la ciudad no existe" (que las funciones de este módulo
 * señalan devolviendo null o un arreglo vacío) porque la aplicación reacciona
 * distinto en cada caso: ante un problema de red muestra la última lectura
 * guardada, y ante una ciudad inexistente le pide al usuario que corrija la
 * búsqueda.
 */
export class NetworkError extends Error {
  constructor(cause) {
    super('No hubo respuesta de Open-Meteo');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/*
 * Envoltorio de axios.get: es el único lugar del módulo que conoce la forma en
 * que axios reporta una falla de red, de modo que el resto del código trabaja
 * con NetworkError y no con los detalles de la biblioteca.
 */
async function get(url, config) {
  try {
    return await axios.get(url, config);
  } catch (err) {
    // axios deja sin `response` a las peticiones que nunca llegaron a destino:
    // sin conexión, DNS caído, timeout. Un 404 o un 500 sí traen respuesta, y
    // ahí el problema no es la conectividad.
    if (axios.isAxiosError(err) && !err.response) throw new NetworkError(err);
    throw err;
  }
}

/** Normalize helper for comparisons (remove diacritics, lowercase, trim) */
const norm = (s) =>
  s?.toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim() || '';

/** Parse "City[, Admin][, CC]" and build geocoding params (Open-Meteo) */
function buildGeocodeParams(input) {
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);

  let city = parts[0] || '';
  let admin = null;
  let cc = null; // ISO-3166 alpha-2 country code

  if (parts.length === 2) {
    const tail = parts[1];
    if (/^[A-Za-z]{2}$/.test(tail)) cc = tail.toUpperCase();
  } else if (parts.length >= 3) {
    admin = parts[1];
    const tail = parts[parts.length - 1];
    if (/^[A-Za-z]{2}$/.test(tail)) cc = tail.toUpperCase();
    // enriquecer name con admin para reducir ambigüedad
    city = `${city} ${admin}`;
  }

  const params = {
    name: city,
    count: 10,
    language: 'es',
    format: 'json',
    ...(cc ? { countryCode: cc } : {}),
  };

  return { params, adminRaw: admin, cc };
}

/** Call Open-Meteo geocoding; returns an array of raw results or [] */
async function geocodeMany(input) {
  const url = 'https://geocoding-api.open-meteo.com/v1/search';

  // 1) intento con parsing inteligente
  const { params, adminRaw } = buildGeocodeParams(input);
  const resp1 = await get(url, {
    params,
    validateStatus: () => true,
  });

  let results = Array.isArray(resp1.data?.results) ? resp1.data.results : [];

  // 2) fallback sin coma: primera parte del input
  if (!results.length) {
    const simple = input.split(',')[0].trim();
    const resp2 = await get(url, {
      params: { name: simple, count: 10, language: 'es', format: 'json' },
      validateStatus: () => true,
    });
    results = Array.isArray(resp2.data?.results) ? resp2.data.results : [];
  }

  // Filtro opcional por admin1 si el usuario lo entregó (3 partes)
  if (results.length && adminRaw) {
    const adminN = norm(adminRaw);
    const filtered = results.filter((r) => norm(r.admin1).includes(adminN));
    if (filtered.length) results = filtered;
  }

  // Orden heurístico: población desc (si no hay, quedan últimos)
  results.sort((a, b) => (b.population || 0) - (a.population || 0));

  // Map a un shape estable
  return results.map((r) => ({
    id: r.id,
    name: r.name,
    admin1: r.admin1 || null,
    country: r.country,
    country_code: r.country_code,
    latitude: r.latitude,
    longitude: r.longitude,
    population: r.population ?? null,
    timezone: r.timezone || 'auto',
  }));
}

/** Fetch weather for one location (coords) using Open-Meteo Forecast API */
async function fetchWeatherForLocation({ latitude, longitude, timezone }) {
  const url = 'https://api.open-meteo.com/v1/forecast';
  const params = {
    latitude,
    longitude,
    timezone: timezone || 'auto',
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m',
    hourly: 'temperature_2m',
    daily: 'temperature_2m_min,temperature_2m_max',
  };

  const { data } = await get(url, { params });

  // Current
  const temp = data?.current?.temperature_2m ?? null;
  const humidity = data?.current?.relative_humidity_2m ?? null;
  const wind = data?.current?.wind_speed_10m ?? null;

  // Pronóstico diario (hoy)
  const dMin = Array.isArray(data?.daily?.temperature_2m_min) ? data.daily.temperature_2m_min[0] : null;
  const dMax = Array.isArray(data?.daily?.temperature_2m_max) ? data.daily.temperature_2m_max[0] : null;

  // Observado hoy hasta "ahora" (min/max de hourly del día en curso)
  let obsMin = null;
  let obsMax = null;
  try {
    const times = data?.hourly?.time || [];
    const temps = data?.hourly?.temperature_2m || [];
    if (times.length && temps.length && times.length === temps.length) {
      // Tomamos la fecha de la primera entrada y la fecha actual del "current"
      const currentTime = data?.current?.time || null;

      // Índices del día actual
      const currentDate = currentTime ? currentTime.slice(0, 10) : null; // YYYY-MM-DD
      const idxToday = times
        .map((t, i) => [t.slice(0, 10), i])
        .filter(([d]) => (currentDate ? d === currentDate : true))
        .map(([, i]) => i);

      if (idxToday.length) {
        // Si conocemos la hora actual dentro de hourly, limitamos hasta ese índice
        let endIdx = times.findIndex((t) => t === currentTime);
        if (endIdx === -1) endIdx = idxToday[idxToday.length - 1]; // fallback: último del día

        const todayIndices = idxToday.filter((i) => i <= endIdx);
        const observed = todayIndices.map((i) => temps[i]).filter((v) => typeof v === 'number');
        if (observed.length) {
          obsMin = Math.min(...observed);
          obsMax = Math.max(...observed);
        }
      }
    }
  } catch {
    // silencioso
  }

  const round = (x) => (x == null ? null : Number.parseFloat(x).toFixed(1));

  return {
    temp: round(temp),
    humidity: humidity == null ? null : Math.round(humidity),
    wind: wind == null ? null : Math.round(wind),
    tempMinObserved: round(obsMin),
    tempMaxObserved: round(obsMax),
    tempMinForecast: round(dMin),
    tempMaxForecast: round(dMax),
  };
}

/** Public API: fetchWeatherMulti(query)
 * - Geocodifica múltiples ubicaciones
 * - Para cada una obtiene clima
 * - Devuelve arreglo [{ location, temps }]
 */
export async function fetchWeatherMulti(query) {
  try {
    const locs = await geocodeMany(query);
    if (!locs.length) return [];

    // Fetch en paralelo
    const settled = await Promise.all(
      locs.map((loc) =>
        fetchWeatherForLocation(loc)
          .then((temps) => ({ temps }))
          .catch((err) => ({ err }))
      )
    );

    // Si la red se cortó a mitad de camino, el problema no es que la ciudad no
    // exista, y quien llamó necesita saberlo para mostrar lo que tenga guardado.
    const networkFailure = settled.find(({ err }) => err instanceof NetworkError);
    if (networkFailure) throw networkFailure.err;

    // Merge location + temps y filtra fallidos
    const results = locs
      .map((loc, i) => ({ location: loc, temps: settled[i].temps }))
      .filter((x) => x.temps != null);

    // Ya vienen ordenados por población (geocodeMany los ordena)
    return results;
  } catch (err) {
    // NetworkError viaja hacia arriba; el resto se registra y se trata como
    // "no hubo resultados".
    if (err instanceof NetworkError) throw err;

    console.error('fetchWeatherMulti failed:', err);
    return [];
  }
}

/** Back-compat: single fetch if you still need it elsewhere */
export default async function fetchWeather(singleQuery) {
  const all = await fetchWeatherMulti(singleQuery);
  return all[0]?.temps ? all[0].temps : null;
}
