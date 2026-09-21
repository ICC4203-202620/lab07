// Caché de las lecturas de clima, en localStorage.
//
// El service worker guarda los archivos de la aplicación; este módulo guarda
// los datos, junto con la hora en que se obtuvieron. Esa hora es la razón de
// tener el caché acá y no en el service worker: queremos poder decirle al
// usuario desde cuándo es la información que está viendo.

const PREFIX = 'weather:';

const keyFor = (city) => PREFIX + city.trim().toLowerCase();

export function saveWeather(city, weather) {
  try {
    const entry = { weather, savedAt: Date.now() };
    localStorage.setItem(keyFor(city), JSON.stringify(entry));
  } catch (err) {
    // Modo privado, cuota agotada o almacenamiento bloqueado: la aplicación
    // sigue funcionando, solo que sin información guardada.
    console.warn('No se pudo guardar el clima en caché:', err);
  }
}

export function loadWeather(city) {
  try {
    const raw = localStorage.getItem(keyFor(city));
    if (!raw) return null;

    const entry = JSON.parse(raw);
    // Lo que sale de localStorage es texto que pudo escribir cualquiera, y una
    // versión anterior de la aplicación pudo guardarlo con otra forma.
    if (!entry?.weather || typeof entry.savedAt !== 'number') return null;

    return entry;
  } catch (err) {
    console.warn('No se pudo leer el clima en caché:', err);
    return null;
  }
}

const relativeFormat = new Intl.RelativeTimeFormat('es-CL', { numeric: 'auto' });
const hourFormat = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

// Devuelve la antigüedad de una lectura en palabras: "hace 5 minutos",
// "hoy a las 14:32", "el 3 de septiembre, 08:15".
//
// El "ahora" contra el que se compara entra por parámetro en vez de leerse de
// Date.now() acá adentro. Así la función es pura —mismos argumentos, mismo
// resultado— y, sobre todo, el componente puede hacerla recalcular pasándole un
// reloj que avanza (ver el hook useNow). Con Date.now() escondido adentro, el
// texto solo cambiaría cuando algo más provocara un render.
export function formatSavedAt(savedAt, now = Date.now()) {
  const date = new Date(savedAt);
  const minutes = Math.round((now - savedAt) / 60000);

  if (minutes < 1) return 'hace instantes';
  if (minutes < 60) return relativeFormat.format(-minutes, 'minute');
  if (date.toDateString() === new Date(now).toDateString()) {
    return `hoy a las ${hourFormat.format(date)}`;
  }
  return `el ${dateFormat.format(date)}`;
}
