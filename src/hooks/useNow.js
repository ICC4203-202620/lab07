import { useEffect, useState } from 'react';

/*
 * Hora actual, que se refresca sola cada `intervalMs` milisegundos.
 *
 * Sirve para que un texto derivado del paso del tiempo —"hace 5 minutos"— no
 * se quede congelado en pantalla. React re-renderiza cuando cambia el estado,
 * y acá lo que cambia es simplemente el reloj.
 *
 * Pasar 0 (o null) desactiva el intervalo y deja el valor fijo. Los hooks no se
 * pueden llamar condicionalmente, pero sí pueden no hacer nada: así un
 * componente que en este momento no tiene ninguna fecha que mostrar evita
 * despertar al navegador cada medio minuto sin motivo.
 */
export default function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!intervalMs) return;

    const id = setInterval(() => setNow(Date.now()), intervalMs);

    // Sin esta limpieza el intervalo seguiría corriendo después de que el
    // componente desaparezca, llamando a setNow sobre un estado que ya no
    // existe. Con varias tarjetas montándose y desmontándose, se acumulan.
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
