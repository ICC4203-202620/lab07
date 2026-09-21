import { useEffect, useState } from 'react';
import { Autocomplete, Box, TextField, Button, Typography } from '@mui/material';
import useLocalStorageState from 'use-local-storage-state';
import SearchIcon from '@mui/icons-material/Search';
import { fetchWeatherMulti, NetworkError } from '../api/weatherApi';
import useConnectionStatus from '../hooks/useConnectionStatus';
import SearchResult from './SearchResult';
import PropTypes from 'prop-types';

function Search({ isFavorite, onAddFavorite }) {
  const [inputValue, setInputValue] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);   // [{ location, temps }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    // Igual que en Weather: si la conexión cambia con una búsqueda en vuelo,
    // esta bandera impide que la respuesta atrasada pise el estado que dejó la
    // ejecución más reciente del efecto.
    let current = true;

    const run = async () => {
      setLoading(true);
      setError('');
      setResults([]);

      try {
        const arr = await fetchWeatherMulti(query);

        if (!current) return;

        if (arr.length) {
          setResults(arr);
          if (query && !keywordList.includes(query)) {
            setKeywordList([...keywordList, query]);
          }
        } else {
          setError('No se encontraron ubicaciones para tu búsqueda.');
        }
      } catch (e) {
        if (!current) return;

        if (e instanceof NetworkError) {
          setError('Sin conexión: no es posible buscar ciudades nuevas. Las que ya agregaste a Inicio siguen disponibles.');
        } else {
          setError('Ocurrió un error al realizar la búsqueda.');
        }
      } finally {
        if (current) setLoading(false);
      }
    };

    if (query) run();

    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, disconnected]);

  const handleSearch = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError('Ingresa una ciudad para buscar.');
      setResults([]);
      return;
    }
    setQuery(trimmed);
  };

  return (
    <>
      <Box sx={{ m: 2, maxWidth: 900, mx: 'auto', bgcolor: 'white' }}>
        <Autocomplete
          freeSolo
          options={keywordList}
          value={inputValue}
          onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
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

        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleSearch}
          startIcon={<SearchIcon />}
          disabled={loading}
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </Button>

        {error && (
          <Box sx={{ mt: 1, color: 'error.main', fontSize: 14 }}>
            {error}
          </Box>
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
        {results.map(({ location, temps }) => {
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
      {!!results.length && (
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
