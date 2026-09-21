import { useEffect, useReducer } from 'react';
import { Alert, Autocomplete, Box, TextField, Button, Typography, Stack } from '@mui/material';
import useLocalStorageState from 'use-local-storage-state';
import SearchIcon from '@mui/icons-material/Search';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { fetchWeatherMulti, NetworkError } from '../api/weatherApi';
import useConnectionStatus from '../hooks/useConnectionStatus';
import SearchResult from './SearchResult';
import PropTypes from 'prop-types';

/*
 * Estado de la búsqueda, manejado con useReducer.
 *
 * Con useState eran cinco variables sueltas, y cada handler tenía que acordarse
 * de actualizarlas todas en conjunto: al empezar una búsqueda había que subir
 * `loading`, vaciar `results` y borrar `error`, en tres llamadas separadas. Un
 * olvido dejaba la pantalla en un estado que no corresponde a nada real, como
 * "cargando" con un error de la búsqueda anterior todavía visible.
 *
 * El reducer invierte el planteamiento: en vez de describir qué variable cambia,
 * se describe QUÉ PASÓ (`START_SEARCH`, `SEARCH_SUCCESS`, …), y un solo lugar
 * decide cómo queda el estado completo ante cada suceso. Las combinaciones
 * inválidas dejan de ser posibles porque nadie puede construirlas.
 *
 * Nota que `inputValue` también vive acá. Podría haberse quedado en un useState
 * aparte —cambia con cada tecla y no interactúa con el resto—, pero tenerlo
 * junto permite que RESET lo considere, y deja un único origen de verdad para
 * todo lo que el componente sabe.
 */
const initialState = {
  inputValue: '',   // texto que el usuario está escribiendo
  query: '',        // término confirmado, el que dispara la consulta
  results: [],      // [{ location, temps }]
  loading: false,
  error: '',
  offline: false,   // ¿el error actual se debe a la falta de red?
};

const ACTIONS = {
  SET_INPUT: 'SET_INPUT',
  START_SEARCH: 'START_SEARCH',
  SEARCH_SUCCESS: 'SEARCH_SUCCESS',
  SEARCH_ERROR: 'SEARCH_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RESET: 'RESET',
};

const OFFLINE_MESSAGE =
  'Sin conexión: no es posible buscar ciudades nuevas. Las que ya agregaste a Inicio siguen disponibles.';

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_INPUT:
      return { ...state, inputValue: action.payload };

    case ACTIONS.START_SEARCH:
      return {
        ...state,
        query: action.payload,
        loading: true,
        error: '',
        offline: false,
        results: [],
      };

    case ACTIONS.SEARCH_SUCCESS:
      return { ...state, loading: false, error: '', offline: false, results: action.payload };

    case ACTIONS.SEARCH_ERROR:
      return { ...state, loading: false, results: [], offline: false, error: action.payload };

    // Se conserva `query` a propósito: el efecto depende también del estado de
    // la conexión, así que al volver la red se repite sola la búsqueda que no
    // se pudo hacer. Y `offline` permite presentarlo como una circunstancia y
    // no como un error del usuario.
    case ACTIONS.NETWORK_ERROR:
      return { ...state, loading: false, results: [], offline: true, error: OFFLINE_MESSAGE };

    // Vaciar el campo de texto limpia la pantalla. Poner `query` en '' tiene un
    // efecto secundario útil: la próxima vez que se busque ese mismo término,
    // `query` volverá a cambiar de valor y el efecto se ejecutará de nuevo.
    case ACTIONS.RESET:
      return { ...state, query: '', results: [], loading: false, error: '', offline: false };

    default:
      throw new Error(`Acción no soportada: ${action.type}`);
  }
}

function Search({ isFavorite, onAddFavorite }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Historial de búsquedas
  const [keywordList, setKeywordList] = useLocalStorageState('WeatherApp/Search/KeywordList', {
    defaultValue: []
  });

  const [status] = useConnectionStatus();

  // Buscar exige red: la geocodificación de una ciudad nueva no se puede
  // resolver con lo que haya guardado. Por eso el efecto depende del estado de
  // la conexión, y repite la búsqueda pendiente en cuanto la red vuelve.
  const disconnected = status === 'offline';

  useEffect(() => {
    // Igual que en useWeather: si la conexión cambia con una búsqueda en vuelo,
    // esta bandera impide que la respuesta atrasada pise el estado que dejó la
    // ejecución más reciente del efecto.
    let current = true;

    const run = async () => {
      try {
        const arr = await fetchWeatherMulti(state.query);

        if (!current) return;

        if (arr.length) {
          dispatch({ type: ACTIONS.SEARCH_SUCCESS, payload: arr });
          if (state.query && !keywordList.includes(state.query)) {
            setKeywordList([...keywordList, state.query]);
          }
        } else {
          dispatch({
            type: ACTIONS.SEARCH_ERROR,
            payload: 'No se encontraron ubicaciones para tu búsqueda.',
          });
        }
      } catch (e) {
        if (!current) return;

        if (e instanceof NetworkError) {
          dispatch({ type: ACTIONS.NETWORK_ERROR });
        } else {
          dispatch({
            type: ACTIONS.SEARCH_ERROR,
            payload: 'Ocurrió un error al realizar la búsqueda.',
          });
        }
      }
    };

    if (state.query) run();

    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.query, disconnected]);

  const handleInputChange = (value) => {
    dispatch({ type: ACTIONS.SET_INPUT, payload: value });
    if (!value.trim()) dispatch({ type: ACTIONS.RESET });
  };

  const handleSearch = () => {
    const trimmed = state.inputValue.trim();
    if (!trimmed) {
      dispatch({ type: ACTIONS.SEARCH_ERROR, payload: 'Ingresa una ciudad para buscar.' });
      return;
    }
    dispatch({ type: ACTIONS.START_SEARCH, payload: trimmed });
  };

  const handleClearHistory = () => setKeywordList([]);

  return (
    <>
      <Box sx={{ m: 2, maxWidth: 900, mx: 'auto', bgcolor: 'background.paper' }}>
        <Autocomplete
          freeSolo
          options={keywordList}
          value={state.inputValue}
          onInputChange={(_, newInputValue) => handleInputChange(newInputValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Buscar ciudad (p. ej. 'Santiago, CL' o 'Columbus, OH, US')"
              variant="outlined"
              fullWidth
              sx={{ mb: 2 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
          )}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleSearch}
            startIcon={<SearchIcon />}
            disabled={state.loading}
          >
            {state.loading ? 'Buscando...' : 'Buscar'}
          </Button>

          {/* El botón solo existe si hay algo que limpiar: un control que no
              puede hacer nada es ruido, y deja al usuario dudando de si falló. */}
          {keywordList.length > 0 && (
            <Button
              variant="outlined"
              color="secondary"
              fullWidth
              onClick={handleClearHistory}
              startIcon={<DeleteSweepIcon />}
            >
              Limpiar historial
            </Button>
          )}
        </Stack>

        {state.error && (
          state.offline ? (
            <Alert severity="info" sx={{ mt: 2 }}>{state.error}</Alert>
          ) : (
            <Box sx={{ mt: 1, color: 'error.main', fontSize: 14 }}>{state.error}</Box>
          )
        )}
      </Box>

      {/* Grid de resultados */}
      <Box
        sx={{
          m: 2,
          maxWidth: 1200,
          mx: 'auto',
          display: 'grid',
          gap: 2,
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        }}
      >
        {state.results.map(({ location, temps }) => {
          const label = `${location.name}${location.admin1 ? `, ${location.admin1}` : ''}, ${location.country_code}`;
          return (
            <SearchResult
              key={`${location.id}-${location.latitude}-${location.longitude}`}
              label={label}
              location={location}
              temps={temps}
              isFavorite={isFavorite}
              onAddFavorite={onAddFavorite}
            />
          );
        })}
      </Box>

      {/* indicación de ordenamiento */}
      {!!state.results.length && (
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 3 }}>
          Ordenado por población (descendente).
        </Typography>
      )}
    </>
  );
}

Search.propTypes = {
  isFavorite: PropTypes.func.isRequired,
  onAddFavorite: PropTypes.func.isRequired,
};

export default Search;
