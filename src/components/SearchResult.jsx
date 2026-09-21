import { Card, CardContent, Typography, IconButton, Stack, Tooltip } from '@mui/material';
import PropTypes from 'prop-types';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';

const fmt = (v) => (v == null ? '—' : `${v} °C`);

const SearchResult = ({ label, temps, isFavorite, onAddFavorite }) => {
  if (!temps) return null;

  // Igual que en Weather.jsx: pronóstico si hay; si no, observado
  const maxToday = (temps.tempMaxForecast ?? temps.tempMaxObserved);
  const minToday = (temps.tempMinForecast ?? temps.tempMinObserved);

  const fav = isFavorite?.(label);
  const handleFav = () => {
    if (!fav) onAddFavorite?.(label);
  };

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="start" spacing={1}>
          <Typography variant="h6" component="h3" gutterBottom>
            {label}
          </Typography>
          <Tooltip title={fav ? 'En favoritos' : 'Agregar a favoritos'}>
            <IconButton onClick={handleFav} aria-label="favorite" color={fav ? 'error' : 'default'}>
              {fav ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
          </Tooltip>
        </Stack>

        <Typography variant="body1"><strong>Actual:</strong> {fmt(temps.temp)}</Typography>
        <Typography variant="body1"><strong>Máxima:</strong> {fmt(maxToday)}</Typography>
        <Typography variant="body1"><strong>Mínima:</strong> {fmt(minToday)}</Typography>
      </CardContent>
    </Card>
  );
};

SearchResult.propTypes = {
  label: PropTypes.string.isRequired,
  temps: PropTypes.object,
  isFavorite: PropTypes.func,
  onAddFavorite: PropTypes.func,
};

export default SearchResult;
