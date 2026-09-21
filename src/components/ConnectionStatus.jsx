import { Alert, Snackbar } from '@mui/material';
import useConnectionStatus from '../hooks/useConnectionStatus';

// Aviso global del estado de la conexión: una barra permanente mientras no hay
// red, y una notificación breve cuando vuelve.
const ConnectionStatus = () => {
  const [status, acknowledge] = useConnectionStatus();

  if (status === 'offline') {
    return (
      <Alert severity="warning" square sx={{ borderRadius: 0 }}>
        Estás sin conexión. Se muestra la última información guardada, con su fecha.
      </Alert>
    );
  }

  return (
    <Snackbar
      open={status === 'reconnected'}
      autoHideDuration={4000}
      onClose={acknowledge}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="success" onClose={acknowledge}>
        Conexión recuperada. Actualizando la información.
      </Alert>
    </Snackbar>
  );
};

export default ConnectionStatus;
