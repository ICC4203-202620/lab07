import { useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Tooltip,
  Fab,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PropTypes from 'prop-types';
import Weather from './Weather';

/** Hash simple para derivar color desde el nombre */
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function placeholderGradient(name) {
  const h1 = hash(name) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1} 65% 55%) 0%, hsl(${h2} 65% 45%) 100%)`;
}

function Home({ favorites, removeFavorite }) {
  const scrollerRef = useRef(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    if (el.scrollLeft > maxScrollLeft) {
      el.scrollTo({ left: Math.max(0, maxScrollLeft), behavior: 'smooth' });
    }
  }, [favorites.length]);

  // El ancho visible del carrusel se mide en el momento del click, no durante
  // el render: `scrollerRef.current` es null en el primer render y cambiarlo no
  // provoca uno nuevo, de modo que un useMemo se quedaría con el valor inicial.
  const scrollByAmount = () => {
    const el = scrollerRef.current;
    return el ? Math.floor(el.clientWidth * 0.9) : 600;
  };

  const goLeft = () => scrollerRef.current?.scrollBy({ left: -scrollByAmount(), behavior: 'smooth' });
  const goRight = () => scrollerRef.current?.scrollBy({ left: scrollByAmount(), behavior: 'smooth' });

  // Drag-to-scroll (desktop/mouse)
  const dragging = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = scrollerRef.current;
    if (!el) return;
    dragging.current = true;
    startX.current = e.clientX;
    startScrollLeft.current = el.scrollLeft;
    el.setPointerCapture?.(e.pointerId);
    el.style.cursor = 'grabbing';
  };
  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse' || !dragging.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dx = e.clientX - startX.current;
    el.scrollLeft = startScrollLeft.current - dx;
  };
  const onPointerUp = (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = scrollerRef.current;
    dragging.current = false;
    if (el) el.style.cursor = '';
  };

  if (favorites.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Aún no tienes ciudades en tu Inicio
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Agrega ubicaciones desde <strong>Buscar</strong> para verlas aquí como tarjetas.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        px: { xs: 1, sm: 2 },
        py: 1,
        display: 'flex',
        alignItems: 'center',
        '@media (orientation: portrait)': { minHeight: '72dvh' },
        '@media (orientation: landscape)': { minHeight: '56dvh' },
      }}
    >
      {/* Flechas */}
      <Fab
        size="small"
        onClick={goLeft}
        aria-label="Anterior"
        sx={{
          position: 'absolute',
          top: '50%',
          left: { xs: 6, sm: 12 },
          transform: 'translateY(-50%)',
          zIndex: 2,
          boxShadow: 2,
          '@media (orientation: portrait)': { top: '58%' },
        }}
      >
        <ChevronLeftIcon />
      </Fab>
      <Fab
        size="small"
        onClick={goRight}
        aria-label="Siguiente"
        sx={{
          position: 'absolute',
          top: '50%',
          right: { xs: 6, sm: 12 },
          transform: 'translateY(-50%)',
          zIndex: 2,
          boxShadow: 2,
          '@media (orientation: portrait)': { top: '58%' },
        }}
      >
        <ChevronRightIcon />
      </Fab>

      {/* Carrusel */}
      <Box
        ref={scrollerRef}
        role="list"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        sx={{
          // variable para gap reutilizable (ajústala si quieres aún menos separación)
          '--gap': '14px',

          display: 'grid',
          gridAutoFlow: 'column',
          gap: 'var(--gap)',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          scrollPadding: '16px',
          touchAction: 'pan-x',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
          py: 1,
          mx: 'auto',
          width: '100%',

          // ===== Portrait: una card casi full-width
          gridAutoColumns: { xs: '94vw', sm: '520px' },

          // ===== Landscape: EXACTO 2-up, sin “hoyo” al medio
          '@media (orientation: landscape)': {
            // Dos columnas exactas: (100% - gap) / 2
            gridAutoColumns: 'calc((100% - var(--gap)) / 2)',
          },
        }}
      >
        {favorites.map((location) => (
          <Card
            role="listitem"
            key={location}
            sx={{
              // Evita centrar en landscape: snap al inicio (izquierda)
              scrollSnapAlign: 'center',
              '@media (orientation: landscape)': { scrollSnapAlign: 'start',  height: 340 },

              borderRadius: 3,
              boxShadow: 3,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',

              // Portrait: alta para aprovechar alto; Landscape: más chata
              '@media (orientation: portrait)': { height: 'min(82dvh, 720px)' },
            }}
          >
            {/* Header/imagen (más bajo en landscape) */}
            <Box
              sx={{
                position: 'relative',
                background: placeholderGradient(location),

                // Portrait alto; Landscape chato
                aspectRatio: { xs: '4 / 5', sm: '16 / 9' },
                '@media (orientation: portrait)': { aspectRatio: '4 / 5' },
                '@media (orientation: landscape)': { aspectRatio: '4 / 1' },

                flex: { xs: '0 0 auto' },
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  position: 'absolute',
                  left: 16,
                  bottom: 12,
                  color: 'white',
                  textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  pr: 6,
                }}
              >
                {location}
              </Typography>

              <Tooltip title="Quitar de Inicio">
                <IconButton
                  onClick={() => removeFavorite(location)}
                  aria-label={`Quitar ${location}`}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'rgba(255,255,255,0.85)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                    boxShadow: 1,
                  }}
                >
                  <DeleteIcon color="error" />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Contenido */}
            <CardContent
              sx={{
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                '@media (orientation: portrait)': { flex: 1 },
              }}
            >
              <Stack spacing={1} sx={{ flex: 1 }}>
                <Weather location={location} />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

Home.propTypes = {
  favorites: PropTypes.arrayOf(PropTypes.string).isRequired,
  removeFavorite: PropTypes.func.isRequired,
};

export default Home;
