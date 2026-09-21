# Laboratorio 7: Hooks de React, estado local y funcionamiento sin conexión

En este laboratorio continuaremos desarrollando la aplicación de clima con React y MUI que conociste en el laboratorio anterior. La aplicación utiliza la API de [Open-Meteo](https://open-meteo.com/) para acceder a información climática.

Respecto del laboratorio 6, la aplicación creció en dos direcciones. Por un lado, ahora permite **buscar ubicaciones geográficas** y **guardar ciudades favoritas**, que se muestran en la pantalla de inicio; esto nos da la excusa para trabajar en serio con los hooks de React y con `localStorage`. Por otro lado, mantiene y extiende su condición de **PWA**: el service worker guarda los archivos de la aplicación, y ahora hay una lectura de clima guardada por cada ciudad, de modo que sin conexión no se ve una pantalla vacía sino la última información disponible con su fecha.

El hilo conductor del laboratorio es el **estado local**: dónde vive, cómo se actualiza, cómo se persiste entre sesiones y cómo se comparte la lógica que lo maneja mediante *hooks propios*.

## Pasos iniciales

Antes de partir, verifica tu versión de Node.js con `node -v`. Vite 8 requiere Node 20.19 o superior, o bien 22.12 o superior. Si tienes una versión anterior, actualízala con [nvm](https://github.com/nvm-sh/nvm) o con el instalador de [nodejs.org](https://nodejs.org/).

El primer paso es ejecutar:

```sh
yarn install    # o npm install
```

Esto instalará todos los paquetes o módulos especificados en el archivo `package.json` que requiere la aplicación. Preferimos utilizar Yarn para gestión de módulos y dependencias de Javascript.

Si prefieres npm, sirve igual. La equivalencia es directa:

| Yarn | npm |
| --- | --- |
| `yarn install` | `npm install` |
| `yarn add <paquete>` | `npm install <paquete>` |
| `yarn dev` | `npm run dev` |

La última fila vale para cualquier script declarado en `package.json`: `build`, `lint` y `preview` se invocan igual, anteponiendo `npm run`. Los comandos del enunciado llevan su equivalente en un comentario, y donde no lo lleven basta con aplicar esa regla.

Puedes usar npm sobre este repositorio sin problemas: como no hay un `package-lock.json`, npm lee `yarn.lock` e instala exactamente las mismas versiones que resolvió Yarn. Lo que conviene es elegir uno de los dos y quedarse con él, porque npm generará además su propio archivo de lock, y dos archivos de lock que se contradicen hacen que dos personas terminen con dependencias distintas.

Con las dependencias instaladas, la aplicación está lista para ejecutar:

```sh
yarn dev    # o npm run dev
```

El comando anterior ejecuta la aplicación en modo de desarrollo. Puedes abrir el navegador web en [http://localhost:5173/](http://localhost:5173/) para ver el funcionamiento.

Ten presente que el service worker **no se registra en modo desarrollo**, a propósito. Para probar el comportamiento sin conexión hay que construir la aplicación y servirla, como se explica más adelante en la sección [Cómo probarlo](#cómo-probarlo).

## Marco Teórico: Hooks en React

A partir de React 16, lanzado en 2019, los hooks son funciones especiales que permiten gestionar aspectos clave del ciclo de vida de los componentes funcionales, como el estado, los efectos secundarios, y otros comportamientos, de manera simple y eficiente. "Engancharse" a estas características significa que los hooks te permiten insertar lógica en puntos específicos del ciclo de vida de un componente funcional.

Este proyecto usa **React 19**. Los hooks que verás a continuación se comportan igual que en versiones anteriores; lo que cambió en las versiones recientes son sobre todo detalles de rendimiento y de renderizado concurrente que no afectan lo que haremos acá.

### Hook useState

El hook `useState` permite agregar estado a un componente funcional en React. Cuando llamas a `useState`, obtienes una pareja de valores: el estado actual y una función que te permite actualizar ese estado. La ventaja de usar `useState` es que React re-renderiza automáticamente el componente cada vez que el estado cambia, asegurando que la interfaz se actualice correctamente.

Ejemplo:

```es6
import React, { useState } from 'react';

function Contador() {
  // Declara una nueva variable de estado, llamada "contador"
  const [contador, setContador] = useState(0);

  return (
    <div>
      <p>Has hecho clic {contador} veces</p>
      <button onClick={() => setContador(contador + 1)}>
        Haz clic
      </button>
    </div>
  );
}

export default Contador;
```

En este ejemplo, `useState(0)` inicializa el estado contador con un valor de 0. Cuando el usuario hace clic en el botón, se llama a `setContador`, lo que incrementa el valor de contador y provoca una re-renderización del componente, actualizando el número de clics mostrados.

### Hook useEffect

El hook `useEffect` se utiliza para manejar efectos secundarios en los componentes de React. Esto incluye tareas como la recuperación de datos, la suscripción a servicios, o la manipulación directa del DOM. `useEffect` se ejecuta después de que el componente se haya renderizado y, por defecto, lo hace después de cada actualización. Sin embargo, también puede configurarse para ejecutarse solo cuando cambian ciertos valores.

```es6
import React, { useState, useEffect } from 'react';

function Contador() {
  const [contador, setContador] = useState(0);

  // Hook useEffect para actualizar el título del documento
  useEffect(() => {
    document.title = `Has hecho clic ${contador} veces`;
  }, [contador]); // Solo vuelve a ejecutarse si cambia "contador"

  return (
    <div>
      <p>Has hecho clic {contador} veces</p>
      <button onClick={() => setContador(contador + 1)}>
        Haz clic
      </button>
    </div>
  );
}

export default Contador;
```

En este caso, el hook `useEffect` se utiliza para actualizar el título de la página cada vez que cambia el valor de contador. El segundo argumento de `useEffect` es un array de dependencias (`[contador]`), que indica que el efecto solo debe ejecutarse cuando contador cambie, optimizando así el rendimiento.

#### La función de limpieza

Hay una parte de `useEffect` que se olvida con facilidad y que en esta aplicación resulta central: el efecto puede **devolver una función**, y React la ejecuta antes de volver a correr el efecto y al desmontarse el componente.

```es6
useEffect(() => {
  const id = setInterval(() => console.log('tic'), 1000);
  return () => clearInterval(id);  // limpieza
}, []);
```

Sin ese `return`, cada montaje del componente dejaría un intervalo corriendo para siempre. Lo mismo vale para suscripciones a eventos del navegador, que es justamente lo que hace el hook `useConnectionStatus` de este proyecto. Con `React.StrictMode` activo, React monta y desmonta cada efecto una vez extra en desarrollo, precisamente para que una limpieza ausente se note temprano.

La limpieza sirve además para un segundo propósito, que verás en `Weather` y en `Search`: **descartar respuestas atrasadas**. Si un efecto lanza una petición asíncrona y vuelve a ejecutarse antes de que esa petición termine, la respuesta vieja podría sobrescribir el estado que dejó la ejecución más reciente. El patrón para evitarlo es una bandera local que la limpieza apaga:

```es6
useEffect(() => {
  let current = true;

  (async () => {
    const data = await fetchAlgo(param);
    if (!current) return;   // esta ejecución ya quedó obsoleta
    setEstado(data);
  })();

  return () => { current = false; };
}, [param]);
```

### Hook useReducer

React incluye, desde la introducción de los hooks, uno llamado `useReducer` que permite manejar el estado de un componente de manera más compleja que `useState`. Este hook es ideal cuando el estado de un componente depende de múltiples acciones o cuando el estado es un objeto que requiere cambios basados en una lógica más estructurada por casos. Ejemplo de uso:

```es6
import React, { useReducer } from 'react';

const initialState = { contador: 0 };

function reducer(state, action) {
  switch (action.type) {
    case 'incrementar':
      return { contador: state.contador + 1 };
    case 'decrementar':
      return { contador: state.contador - 1 };
    default:
      throw new Error('Acción no soportada');
  }
}

function Contador() {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <div>
      <p>Contador: {state.contador}</p>
      <button onClick={() => dispatch({ type: 'incrementar' })}>
        Incrementar
      </button>
      <button onClick={() => dispatch({ type: 'decrementar' })}>
        Decrementar
      </button>
    </div>
  );
}

export default Contador;
```

La constante `initialState` define el estado inicial del componente, en este caso, un objeto con una propiedad contador inicializada en 0.

Luego, `reducer` es una función que toma _el estado actual y una acción_ como argumentos, y devuelve un nuevo estado basado en el tipo de acción. Aquí, el reducer maneja dos tipos de acciones: incrementar y decrementar.

El hook `useReducer` se usa para crear el estado y el método `dispatch`, que se utiliza para enviar acciones al reducer. Este hook recibe el reducer y el estado inicial como argumentos.

La función `dispatch` se utiliza para enviar acciones al reducer. Cuando se hace clic en los botones, se envían acciones con los tipos incrementar o decrementar, lo que provoca que el estado se actualice de acuerdo con la lógica definida en el reducer.

Este ejemplo es de juguete, pero a medida que las aplicaciones y los componentes se van haciendo más complejos en términos del estado que deben manejar, el uso de reducers hace que el código se vuelva más fácil de mantener y depurar. Con reducers todas las actualizaciones a una variable de estado pasan por definir todos los casos posibles de modificación de estado y cubrir correctamente esos casos.

El componente `Search` de esta aplicación es un buen candidato: maneja cinco variables de estado (`inputValue`, `query`, `results`, `loading`, `error`) que en realidad describen un puñado de situaciones bien definidas. Convertirlo a `useReducer` es uno de los ejercicios propuestos al final.

### Bibliotecas de Hooks: Caso de Axios

Además de los hooks nativos, existen bibliotecas de terceros que extienden la funcionalidad de React ofreciendo hooks personalizados que facilitan tareas comunes. Por ejemplo, `axios-hooks` es una biblioteca que proporciona hooks específicos para hacer solicitudes HTTP con Axios en React. Este hook simplifica la lógica de recuperación de datos y manejo de estados de carga o error en componentes funcionales. Ejemplo:

```es6
import React from 'react';
import useAxios from 'axios-hooks';

function ListaUsuarios() {
  const [{ data, loading, error }] = useAxios('https://api.example.com/users');

  if (loading) return <p>Cargando...</p>;
  if (error) return <p>Error al cargar los datos.</p>;

  return (
    <ul>
      {data.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

export default ListaUsuarios;
```

En este ejemplo, `useAxios` gestiona automáticamente los estados de carga (`loading`) y error (`error`). Así, los desarrolladores pueden enfocarse en la lógica de presentación sin preocuparse por las complejidades de la solicitud HTTP.

Este proyecto **no** usa `axios-hooks`: llama a axios directamente desde `src/api/weatherApi.js`, porque necesitamos controlar con precisión qué ocurre cuando una petición falla por falta de red (ver más abajo). Si quieres experimentar con la biblioteca, puedes instalarla con:

```sh
yarn add axios-hooks    # o npm install axios-hooks
```

### Uso de Local Storage con Hooks

Hemos visto en clases, y en la lectura del libro The Road to React, la existencia y el uso de la API de _Local Storage_, la cual está disponible en [sobre el 90%](https://caniuse.com/?search=localstorage) de los dispositivos móviles actuales. Para utilizar _Local Storage_ con React, es recomendable hacerlo a través de un módulo que provee un hook para ello, llamado
`use-local-storage-state`, el cual puede ser instalado en un proyecto con:

```sh
yarn add use-local-storage-state    # o npm install use-local-storage-state
```

Ejemplo de uso:

```es6
import React from 'react';
import useLocalStorageState from 'use-local-storage-state';

function ContadorConLocalStorage() {
  const [contador, setContador] = useLocalStorageState('contador', { defaultValue: 0 });

  return (
    <div>
      <p>Contador: {contador}</p>
      <button onClick={() => setContador(contador + 1)}>
        Incrementar
      </button>
      <button onClick={() => setContador(0)}>
        Reiniciar
      </button>
    </div>
  );
}

export default ContadorConLocalStorage;
```

El hook `useLocalStorageState` se utiliza en lugar de `useState` para crear una variable de estado que se sincroniza automáticamente con `localStorage`. Al pasar la clave `contador` como primer argumento, el valor de contador se almacena en `localStorage` bajo esa clave. El valor inicial va en el segundo argumento, dentro de un objeto de opciones, como `defaultValue`; esa es la forma que usa la versión 20 del módulo, que es la que trae este proyecto, y la que verás en `App.jsx` y en `Search.jsx`.

Cada vez que se actualiza el valor de `contador`, también se actualiza el valor almacenado en `localStorage`. Si el usuario recarga la página o vuelve a ella más tarde, el contador comenzará desde el valor que estaba en `localStorage` en lugar de resetearse.

Es importante notar que las claves guardadas en `localStorage` pueden colisionar entre aplicaciones distintas si no se toman precauciones. Por ejemplo, la clave `contador` es demasiado genérica y perfectamente podría ser utilizada en diferentes aplicaciones, con efectos no deseados, e incluso dañinos. Hay buenas prácticas para prevenir esto:

Uso de prefijos en las claves: Usar prefijos únicos para las claves en `localStorage` es una de las prácticas más comunes. Esto asegura que las claves sean únicas dentro del ámbito de tu aplicación, incluso si se usan nombres genéricos como `contador`. El prefijo podría incluir el nombre de la aplicación, el módulo, o alguna otra identificación única.

Ejemplo:

```es6
const [contador, setContador] = useLocalStorageState('miApp-contador', { defaultValue: 0 });
```

En este caso, `miApp-contador` se utiliza como clave en `localStorage`, lo que reduce el riesgo de colisiones con otras aplicaciones.

Uso de espacios de nombre (namespaces): Otra buena práctica es utilizar espacios de nombres o nombres jerárquicos. Esto es útil si tienes múltiples módulos o funcionalidades que necesitan almacenar datos en `localStorage`. Puedes estructurar las claves de manera jerárquica para organizar mejor los datos. Ejemplo:

```es6
const [contador, setContador] = useLocalStorageState('miApp/moduloA/contador', { defaultValue: 0 });
```

Este esquema de clave `miApp/moduloA/contador` asegura que la clave es específica a un módulo dentro de la aplicación, minimizando las posibilidades de colisión.

Uso de identificadores únicos: En algunos casos, podrías querer incluir identificadores únicos, como el ID de un usuario o el identificador de una sesión, en las claves. Esto es útil en aplicaciones que manejan múltiples usuarios o sesiones simultáneas. Ejemplo:

```es6
const userId = 'user123';
const [contador, setContador] = useLocalStorageState(`miApp/${userId}/contador`, { defaultValue: 0 });
```

Aquí, la clave `miApp/user123/contador` asegura que el estado es específico al usuario actual.

Esta aplicación sigue esas convenciones. Usa `WeatherApp/Favorites` para la lista de ciudades favoritas, `WeatherApp/Search/KeywordList` para el historial de búsquedas, y el prefijo `weather:` para las lecturas de clima guardadas, una por ciudad.

Es importante mantener una convención clara y consistente para nombrar las claves en `localStorage` a lo largo de la aplicación. Documentar estas convenciones ayudará a todos los desarrolladores en el equipo a seguir las mismas prácticas, reduciendo aún más la posibilidad de errores.

Por último, implementar validaciones y manejo de errores al interactuar con `localStorage` es una buena práctica para manejar situaciones inesperadas, como la falta de espacio o acceso denegado. También es recomendable comprobar que los valores obtenidos desde localStorage tienen el formato esperado.

```es6
const storedValue = localStorage.getItem('miApp-contador');
const contador = storedValue ? JSON.parse(storedValue) : 0;
```

Esto no es una precaución teórica: en una ventana privada, o con el almacenamiento bloqueado por el usuario, `localStorage` **lanza una excepción** al usarse. Por eso todos los accesos de `src/api/weatherCache.js` van dentro de un `try`, y por eso ese módulo valida la forma de lo que lee antes de devolverlo. Lo que sale de `localStorage` es texto que pudo escribir cualquiera, o que pudo dejar ahí una versión anterior de tu propia aplicación.

### Hooks propios

Los hooks que hemos visto hasta aquí vienen con React. También puedes escribir los tuyos, y es lo que hace este proyecto en `src/hooks/useConnectionStatus.js`.

Un hook propio es, simplemente, **una función que llama a otros hooks** y que vive fuera de los componentes para que varios puedan usarla. Todo el mecanismo es ese. La única condición de la que dependen React y el linter es el nombre: tiene que empezar con `use`.

Las reglas de los hooks valen igual dentro de un hook propio:

* Se llaman siempre en el **nivel superior** de la función, jamás dentro de un `if`, de un ciclo o de una función anidada, porque React identifica cada hook por el orden en que se lo llama.
* Solo se llaman **desde un componente o desde otro hook**, nunca desde una función cualquiera.

Ambas reglas las revisa `eslint-plugin-react-hooks`, que el proyecto tiene configurado, así que `yarn lint` te avisa si las rompes.

**Qué merece ser un hook propio.** El buen candidato es la lógica que **combina estado con un efecto** y que aparece repetida en varios componentes. Si tres componentes necesitan lo mismo y cada uno declara su propia variable de estado con su propio `useEffect`, el mismo bloque queda escrito tres veces y basta con corregir uno para que los otros se queden atrás.

En cambio, lo que **no llama a ningún hook** se queda como función normal. `formatSavedAt`, en `src/api/weatherCache.js`, recibe una marca de tiempo y devuelve un texto: sin estado y sin efectos, y por eso su nombre no empieza con `use`.

**Cada llamada tiene su propio estado.** Este es el punto que más confunde al principio. Si dos componentes llaman al mismo hook propio, cada uno recibe una variable de estado **independiente** de la del otro. Un hook comparte *lógica*, no *datos*. En `useConnectionStatus` los distintos consumidores se mantienen coordinados porque todos escuchan los mismos eventos del navegador, y no porque el hook guarde algo en común. El día que necesites estado realmente compartido —algo que un componente escribe y otro lee— un hook por sí solo no alcanza, y ahí entra el Context de React.

Más abajo, en la sección sobre el funcionamiento sin conexión, revisamos `useConnectionStatus` línea por línea.

## Descripción de la Aplicación React

La aplicación permite buscar ubicaciones geográficas para realizar seguimiento del clima, y guardar ubicaciones favoritas que se despliegan en la pantalla de inicio. Para esto utiliza los hooks de React nombrados arriba, `localStorage`, varios componentes de MUI, y un service worker que la convierte en una PWA instalable y capaz de abrirse sin conexión.

## Componentes de la Aplicación

### Index

La página de carga de la aplicación SPA desarrollada con React es `index.html`. En este archivo se declara un elemento raíz de tipo `div` con `id` con valor `root`, y se carga el archivo `main.jsx`. Este último archivo instancia el componente principal de la aplicación llamado `App` (ver `App.jsx`):

```es6
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme'; // Asegúrate de importar el tema
import registerServiceWorker from './registerServiceWorker';

// Convierte la aplicación en una PWA: deja el service worker a cargo de los
// archivos para que la aplicación pueda abrirse sin conexión.
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <App />
        </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

Además, `index.html` enlaza el manifiesto de la aplicación (`<link rel="manifest">`) y declara el color de tema (`<meta name="theme-color">`), que son las dos piezas que el navegador necesita para ofrecer la instalación.

### Theme de MUI

Existe un _theme_ de MUI (Material UI) configurado para la aplicación que se encuentra descrito en `src/theme.js`. Es posible variar la tipografía Roboto utilizada en la aplicación, el esquema de colores, y en general alterar todas las propiedades personalizables de los componentes de MUI.

El componente `ThemeProvider` decora `App` con el _theme_ cargado en el propio archivo `main.jsx`.

### BrowserRouter

Luego, hay un componente `BrowserRouter`, provisto por React Router, que permite que la aplicación de frontend pueda tener sus propios enlaces (hipervínculos) locales, y procesar los paths que hay en la barra de direcciones del navegador interpretándolos en el contexto local del frontend. Los enlaces permiten acceder a distintos componentes de la aplicación que quedan instanciados por el componente `App`.

### React.StrictMode

Finalmente `React.StrictMode` permite comunicar advertencias o errores al desarrollador respecto a prácticas erróneas en el desarrollo de la aplicación, asociadas a potenciales problemas de calidad.

### Componente App

El archivo `App.jsx` define el componente principal de la aplicación `App`. Este componente declara la barra superior (`AppBar`), gestiona las rutas disponibles, y —lo más importante para este laboratorio— **es el dueño del estado de las ciudades favoritas**.

#### El estado de favoritos, y por qué vive acá

```es6
const [favorites, setFavorites] = useLocalStorageState('WeatherApp/Favorites', {
  defaultValue: ['Santiago de Chile'],
});
```

Dos componentes distintos necesitan esta lista: `Home` la lee para dibujar las tarjetas y quitar ciudades, y `Search` la consulta para saber si un resultado ya es favorito y para agregar nuevos. Como ninguno de los dos es ancestro del otro, el estado sube al ancestro común —`App`— y baja a cada uno como *props*. Este movimiento se conoce como **elevar el estado** (*lifting state up*), y es el patrón por defecto en React antes de recurrir a mecanismos más pesados como el Context.

`App` no pasa hacia abajo la lista y su función de actualización en crudo, sino tres operaciones con nombre y significado propio:

* `isFavorite(name)` → `Search` la usa para dibujar el corazón lleno o vacío.
* `onAddFavorite(name)` → agrega, evitando duplicados.
* `removeFavorite(name)` → quita, filtrando la lista.

Pasar operaciones en vez de `setFavorites` mantiene en un solo archivo las reglas sobre cómo puede cambiar la lista. Nota además que las tres crean un arreglo nuevo (`[...favorites, name]`, `favorites.filter(...)`) en lugar de modificar el existente: React compara el valor anterior con el nuevo para decidir si re-renderiza, y un arreglo mutado en su lugar es, para esa comparación, el mismo arreglo de antes.

Como el hook es `useLocalStorageState` y no `useState`, la lista sobrevive a la recarga de la página y al cierre del navegador.

#### El título de la barra

```es6
const location = useLocation();
const title = useMemo(() => {
  if (location.pathname === '/search') return 'Buscar ciudad';
  return 'Clima';
}, [location.pathname]);
```

`useLocation` es un hook de React Router que devuelve la ruta actual, y hace que el componente se vuelva a renderizar cuando ésta cambia. `useMemo` recuerda el resultado de un cálculo entre renders y solo lo repite cuando cambia alguna de sus dependencias. Aquí el cálculo es trivial y `useMemo` no aporta rendimiento; está para que veas la forma del hook. Su utilidad real aparece con cálculos caros, o cuando el valor calculado se pasa como prop a un componente memoizado.

#### El resto

Antes de las rutas, `App` instancia `ConnectionStatus`, el componente que avisa al usuario cuando el dispositivo se queda sin conexión y cuando la recupera.

En las líneas finales, el componente `Routes` asocia rutas (`/`, `/search`) con sus respectivos componentes (`Home`, `Search`). Esto funciona de forma similar al archivo `routes.rb` en Rails, pero en el *frontend*.

### Componente Home

El componente `Home` corresponde a la ruta raíz `/` y muestra un carrusel de las ciudades favoritas guardadas por el usuario. Cada ciudad se despliega en una tarjeta (`Card`) con un encabezado de color generado dinámicamente y el componente `Weather` en su interior.

#### Hooks utilizados

* **`useRef`**:

  * Se usa para referenciar el contenedor desplazable del carrusel (`scrollerRef`).
  * También para manejar banderas internas en el drag-to-scroll (por ejemplo `dragging`, `startX`, `startScrollLeft`).
  * Esto permite implementar el desplazamiento manual con el mouse al arrastrar.

* **`useEffect`**:

  * Observa cambios en la lista de favoritos (`favorites.length`).
  * Garantiza que al agregarse una nueva ciudad el scroll no quede "fuera de rango" y se ajuste suavemente al final.

#### Un detalle sobre `useRef`: no se lee durante el render

Una `ref` sirve para guardar un valor que **no participa del renderizado**: cambiarla no provoca un render nuevo. De ahí se desprende una regla que conviene tener presente, porque es fácil de violar sin darse cuenta: **no se lee `ref.current` durante el render**, sino dentro de un efecto o de un manejador de eventos.

En este componente, el ancho que debe desplazarse el carrusel al hacer click en una flecha se mide en el momento del click:

```es6
const scrollByAmount = () => {
  const el = scrollerRef.current;
  return el ? Math.floor(el.clientWidth * 0.9) : 600;
};
```

Escrito como `useMemo` con `[scrollerRef.current]` en las dependencias, el resultado sería incorrecto: en el primer render la ref todavía vale `null`, el memo devolvería 600, y como asignarle el nodo a la ref no provoca un render nuevo, el valor jamás se recalcularía. La regla `react-hooks/refs` del linter detecta exactamente este caso; pruébalo revirtiendo el código y ejecutando `yarn lint`.

#### Interfaz y comportamiento

* Si no hay ciudades favoritas, se muestra un mensaje central invitando al usuario a agregarlas desde la vista **Buscar**.
* Cuando hay favoritos:

  * Se despliegan tarjetas en un **carrusel horizontal** que soporta:

    * **Botones de flecha** (izquierda y derecha) para navegar.
    * **Arrastre con el mouse** (drag-to-scroll).
  * Cada tarjeta incluye:

    * Un encabezado con el nombre de la ciudad y un botón para **eliminarla** de favoritos.
    * El componente `Weather`, que muestra los datos climáticos de la ubicación.

#### Uso del atributo `sx`

En la mayoría de los componentes de MUI (`Box`, `Card`, `CardContent`, `Typography`, etc.) se emplea el atributo especial **`sx`**.
Este atributo permite **incrustar reglas de estilo CSS directamente en el componente** usando objetos de JavaScript.
Ventajas del uso de `sx`:

* Se pueden definir propiedades estándar de CSS como `display`, `gap`, `padding`, `position`, etc.
* Se pueden incorporar **reglas condicionales por breakpoints o media queries** usando las llaves que ofrece MUI (ej.: `@media (orientation: portrait)`).
* Facilita aplicar estilos locales y específicos sin necesidad de crear clases CSS externas.

Ejemplo del código:

```jsx
<Box
  ref={scrollerRef}
  sx={{
    display: 'grid',
    gridAutoFlow: 'column',
    gap: '14px',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    '@media (orientation: landscape)': {
      gridAutoColumns: 'calc((100% - 14px) / 2)',
    },
  }}
>
  {/* contenido */}
</Box>
```

En este ejemplo, `sx` concentra reglas que normalmente se definirían en un archivo CSS externo, pero aquí se expresan de manera declarativa junto al componente, para que puedas observar directamente cómo se afecta cada componente con las reglas y estilos definidos.

### Componente Search

El componente `Search` corresponde a la ruta `/search` y es uno de los más interactivos de la aplicación.
Su propósito es que el usuario busque ciudades y reciba como resultado tarjetas con información climática de cada ubicación.

#### Hooks y estado

`Search` utiliza varios hooks de React para gestionar el estado interno:

* **`inputValue`** (`useState`)
  Contiene el texto actual que el usuario ha escrito en el campo de búsqueda.

* **`query`** (`useState`)
  Variable que se establece cuando el usuario confirma la búsqueda (al presionar el botón o Enter). Es la que dispara la consulta real a la API.

* **`results`** (`useState`)
  Arreglo con los resultados de la búsqueda. Cada resultado tiene la forma `{ location, temps }`, donde:

  * `location` es un objeto con información de la ciudad (nombre, país, coordenadas, etc.).
  * `temps` son los datos de clima obtenidos desde la API.

* **`loading`** (`useState`)
  Bandera que indica si la búsqueda está en curso, permitiendo mostrar un estado de "Buscando…" en el botón.

* **`error`** (`useState`)
  Contiene mensajes de error que se muestran al usuario si la búsqueda falla o no se encuentran ubicaciones.

* **`keywordList`** (`useLocalStorageState`)
  Historial de términos de búsqueda almacenado en el `localStorage`, bajo la clave `WeatherApp/Search/KeywordList`.
  Se inicializa como un arreglo vacío (`defaultValue: []`) y permite que el usuario tenga sugerencias basadas en búsquedas anteriores.

* **`status`** (`useConnectionStatus`)
  Estado de la conexión, provisto por el hook propio del proyecto.

Fíjate en la distinción entre `inputValue` y `query`. Podría parecer redundante tener dos variables para "lo que el usuario busca", pero cumplen papeles distintos: `inputValue` cambia con cada tecla, mientras que `query` cambia solo cuando el usuario confirma. Si el efecto dependiera de `inputValue`, la aplicación dispararía una consulta a Open-Meteo por cada letra tipeada.

#### Lógica principal

El hook **`useEffect`** escucha cambios en `query` y en el estado de la conexión. Cada vez que alguno cambia:

1. Se limpia el estado (`results` vacío, `error` vacío, `loading` en `true`).
2. Se llama a la función asíncrona `fetchWeatherMulti(query)` para obtener resultados múltiples desde la API.
3. Si se reciben resultados, se actualiza `results` y se agrega `query` a `keywordList` si no estaba presente.
4. Si no hay resultados, se establece un mensaje de error.
5. Si la petición falla con `NetworkError`, se explica que sin conexión no se pueden buscar ciudades nuevas.
6. Al terminar, `loading` vuelve a `false`.

Buscar es la única operación de la aplicación que **exige red de verdad**: geocodificar una ciudad que el usuario nunca consultó no se puede resolver con lo que haya guardado. Por eso acá no hay caché al que recurrir, y lo correcto es decirlo con claridad. Que el efecto dependa además del estado de la conexión hace que la búsqueda pendiente se repita sola en cuanto la red vuelve.

El efecto usa el patrón de la bandera `current` descrito en el marco teórico, por la misma razón que lo usa `Weather`: al depender de dos valores puede reejecutarse con una petición en vuelo.

La función **`handleSearch`** es la encargada de tomar el texto en `inputValue`, validarlo, y actualizar `query`.
Si el campo está vacío, se muestra un error y se limpia el estado de resultados.

#### Interfaz de usuario

El componente `Search` usa varios elementos de MUI:

* **`Autocomplete`**
  Permite al usuario escribir libremente (`freeSolo`) y muestra sugerencias basadas en el historial `keywordList`.
  El valor escrito se sincroniza con `inputValue`. Al presionar Enter, se dispara la búsqueda.

* **`TextField`**
  Campo de texto integrado al `Autocomplete`. Tiene una etiqueta explicativa que da ejemplos de formato:
  `"Santiago, CL"` o `"Columbus, OH, US"`.

* **`Button`**
  Ejecuta `handleSearch` al hacer click. Muestra el ícono `SearchIcon` y cambia su texto dinámicamente entre *Buscar* y *Buscando...* según el estado `loading`.

* **Mensajes de error**
  Cuando la búsqueda falla, se muestra un texto en rojo bajo el campo de búsqueda.

* **Resultados (`SearchResult`)**
  Se renderiza un `Grid` (usando un `Box` con `display: grid`) donde cada elemento es un componente `SearchResult`.
  Cada `SearchResult` recibe:

  * `label`: nombre formateado de la ubicación (incluye país y región si aplica).
  * `location` y `temps`: datos que mostrarán la información climática.
  * `isFavorite` y `onAddFavorite`: funciones para gestionar favoritos.

* **Nota de ordenamiento**
  Si hay resultados, al final se muestra un texto aclarando que los resultados están ordenados por población descendente.

#### Props

El componente recibe dos propiedades (`props`):

* **`isFavorite(location)`**: función que indica si una ubicación ya está marcada como favorita.
* **`onAddFavorite(location)`**: función que permite agregar una ubicación a favoritos.

Ambas son requeridas y están tipadas con `PropTypes`.

### Componente SearchResult

El componente `SearchResult` recibe como propiedades (`props`) los datos de una ubicación obtenida en la búsqueda.
Su función es presentar cada resultado en un formato de tarjeta (`Card` de MUI).

* Muestra el nombre formateado de la ubicación y sus temperaturas actual, máxima y mínima.
* Incorpora un botón con forma de corazón para agregar esa ubicación como favorita, lo que se refleja luego en la vista `Home`.

Nota que `SearchResult` no tiene estado propio ni efectos: recibe todo lo que necesita por props y solo dibuja. A este tipo de componente se le llama a veces *de presentación*, y tiene la ventaja de ser trivial de entender y de probar. Cuando puedas, mantén el estado concentrado en unos pocos componentes y deja que el resto solo reciba y muestre.

### Componente Weather

El componente `Weather` es el encargado de obtener la información del clima de una ciudad y mostrarla. Recibe la ciudad por prop (`location`), de modo que `Home` puede instanciar uno por cada favorito.

Maneja cinco variables de estado:

* **`weather`** (`useState`): el objeto con la información meteorológica (temperatura actual, mínima y máxima observada, mínima y máxima pronosticada). Inicialmente `null`.
* **`savedAt`** (`useState`): marca de tiempo de la lectura, cuando lo que se muestra salió del caché por falta de conexión. Vale `null` mientras el dato viene de la red.
* **`loading`** (`useState`): bandera que indica si la petición está en curso, para mostrar el spinner.
* **`error`** (`useState`): mensaje de error, cuando no hay nada que mostrar.
* **`status`** (`useConnectionStatus`): estado de la conexión, que se usa como dependencia del efecto.

Su `useEffect` depende de `[location, disconnected]`: se vuelve a ejecutar si la tarjeta cambia de ciudad, y también cuando la conexión cae o vuelve. De esa segunda dependencia sale la recuperación automática, y es también la razón por la que el efecto necesita la bandera `current`. La lógica de qué mostrar cuando la petición falla se explica en la sección siguiente.

### Componente ConnectionStatus

`ConnectionStatus` es un componente pequeño, instanciado una sola vez desde `App`, cuya única responsabilidad es avisar del estado de la conexión: una barra (`Alert`) permanente mientras no hay red, y una notificación breve (`Snackbar`) cuando vuelve.

El aviso de que no hay conexión se da una sola vez, acá, porque es un estado de la aplicación entera. Las tarjetas de `Weather` no lo repiten: junto a los datos agregan solo la línea con su última actualización, que es justamente lo que la barra no puede saber, ya que cada ciudad en pantalla puede tener una antigüedad distinta. Varias alertas diciendo lo mismo, una encima de otra, se ven mal y hacen dudar de si describen problemas distintos.

### Cliente de la API de Open-Meteo (`weatherApi.js`)

Este módulo implementa la lógica para interactuar con los servicios públicos de [Open-Meteo](https://open-meteo.com/). Contiene funciones de **geocodificación** (búsqueda de ciudades) y de **clima** (estado actual y pronóstico). Su diseño abstrae la complejidad de las llamadas a la API y entrega a los componentes datos ya procesados y listos para usar.

#### La clase `NetworkError` y el envoltorio `get`

`fetchWeather` y `fetchWeatherMulti` tienen dos maneras de fallar, y a la aplicación le importa muchísimo la diferencia:

* **La ciudad no existe.** Se señala devolviendo `null` (o un arreglo vacío), y corresponde pedirle al usuario que corrija la búsqueda.
* **La petición nunca obtuvo respuesta.** Se señala lanzando un `NetworkError`, y corresponde mostrar la lectura guardada.

La distinción se hace con `axios.isAxiosError(err) && !err.response`, porque axios deja sin `response` las peticiones que no llegaron a destino —sin conexión, DNS caído, timeout—, mientras que un 404 o un 500 sí la traen.

Esa comprobación está en un solo lugar, la función `get`, que envuelve a `axios.get`. Es el único punto del módulo que conoce la forma en que axios reporta las fallas; el resto del código trabaja con `NetworkError`, y los componentes no necesitan saber que detrás hay axios. Si mañana el proyecto cambiara a `fetch`, solo habría que reescribir esa función.

#### Función `norm(s)`

* **Propósito:**
  Normaliza cadenas de texto para comparaciones seguras.
  Convierte a minúsculas, quita acentos/diacríticos y elimina espacios sobrantes.
* **Uso:**
  Facilita comparar nombres de regiones (`admin1`) aunque estén escritos con o sin acentos.

#### Función `buildGeocodeParams(input)`

* **Entrada:**
  Un string del tipo `"Ciudad[, Región][, CC]"`. Ejemplos:

  * `"Santiago, CL"`
  * `"Columbus, OH, US"`

* **Comportamiento:**

  1. Separa el input por comas.
  2. Identifica:

     * **city:** nombre de la ciudad (puede enriquecerse con la región para evitar ambigüedad).
     * **admin:** subdivisión administrativa (`admin1`) si se entrega.
     * **cc:** código de país ISO-3166 (2 letras).
  3. Construye un objeto `params` con opciones para el servicio de geocodificación de Open-Meteo:

     * `name` → nombre de la ciudad (con `admin` si corresponde).
     * `count: 10` → máximo de 10 resultados.
     * `language: 'es'` → resultados en español.
     * `format: 'json'`.
     * `countryCode` (si se detecta `cc`).

* **Salida:**
  `{ params, adminRaw, cc }`

#### Función `geocodeMany(input)`

* **Propósito:**
  Llama a la API de geocodificación de Open-Meteo (`/v1/search`) para obtener posibles coincidencias de una ciudad.

* **Flujo principal:**

  1. **Primer intento:** usar `buildGeocodeParams`.
  2. **Fallback:** si no hay resultados, reintenta con solo la primera parte del input.
  3. **Filtro opcional:** si el usuario entregó `admin`, filtra resultados donde `admin1` coincida.
  4. **Ordenamiento:** ordena los resultados por población descendente (heurístico: prioriza ciudades grandes).
  5. **Normalización:** devuelve un arreglo con un formato estable para cada ciudad:

     * `id`, `name`, `admin1`, `country`, `country_code`, `latitude`, `longitude`, `population`, `timezone`.

* **Salida:**
  Array de objetos de ubicación listos para usar en la consulta de clima.

#### Función `fetchWeatherForLocation({ latitude, longitude, timezone })`

* **Propósito:**
  Llama a la API de pronóstico de Open-Meteo (`/v1/forecast`) para obtener:

  * Temperatura actual.
  * Humedad relativa actual.
  * Velocidad del viento actual.
  * Mínimas y máximas pronosticadas para hoy.
  * Mínimas y máximas **observadas** hasta el momento en el día.

* **Parámetros enviados:**

  * `latitude`, `longitude`, `timezone`.
  * Variables solicitadas:

    * `current: temperature_2m, relative_humidity_2m, wind_speed_10m`
    * `hourly: temperature_2m`
    * `daily: temperature_2m_min, temperature_2m_max`

* **Lógica adicional:**

  * Calcula `obsMin` y `obsMax` a partir de las temperaturas horarias disponibles hasta la hora actual del día.
  * Redondea valores numéricos a un decimal o enteros según corresponda.

* **Salida:**
  Objeto con las claves:
  `{ temp, humidity, wind, tempMinObserved, tempMaxObserved, tempMinForecast, tempMaxForecast }`

#### Función `fetchWeatherMulti(query)`

* **Propósito:**
  Función pública que implementa la búsqueda de clima para múltiples ciudades.

* **Flujo:**

  1. Llama a `geocodeMany(query)` para obtener hasta 10 ubicaciones candidatas.
  2. Ejecuta `fetchWeatherForLocation` en paralelo para cada ubicación.
  3. Si alguna de esas consultas falló por red, lanza ese `NetworkError` hacia arriba: el problema no es que la ciudad no exista.
  4. Fusiona cada ubicación con sus datos climáticos (`{ location, temps }`).
  5. Filtra las ubicaciones que no devolvieron clima válido.
  6. Devuelve los resultados en un arreglo, ya ordenados por población.

* **Salida:**
  Array de objetos:

  ```js
  [
    { location: { ... }, temps: { ... } },
    ...
  ]
  ```

#### Función `fetchWeather(singleQuery)` (compatibilidad)

* **Propósito:**
  Versión simplificada para obtener el clima de una sola ubicación.
  Internamente llama a `fetchWeatherMulti` y devuelve solo el primer resultado.

* **Uso:**
  Es la que utiliza el componente `Weather` para cada tarjeta de `Home`.

#### Resumen

Este cliente cumple cuatro objetivos principales:

1. **Interpretar entradas ambiguas** (`buildGeocodeParams`) y consultar la API de geocodificación de Open-Meteo (`geocodeMany`).
2. **Consultar datos de clima detallados** para coordenadas específicas (`fetchWeatherForLocation`).
3. **Proveer una API unificada** al resto de la aplicación (`fetchWeatherMulti`) que entrega resultados enriquecidos y listos para renderizar.
4. **Distinguir la falta de red de la ausencia de resultados** (`NetworkError`), que es lo que permite a los componentes decidir entre mostrar un dato guardado o pedirle al usuario que corrija la búsqueda.

Gracias a este diseño, los componentes de React (`Weather`, `Search`, `SearchResult`) no necesitan preocuparse por los detalles de las llamadas HTTP ni por cómo combinar datos de ubicación y clima.

## Funcionamiento sin conexión

La aplicación es una PWA: el navegador puede instalarla como si fuera nativa, y sigue sirviendo información cuando el dispositivo se queda sin red. Varias piezas lo hacen posible, con responsabilidades bien separadas.

### El manifiesto

`public/manifest.webmanifest` describe la aplicación para el sistema operativo: su nombre, el color de la barra de estado, la pantalla desde la que arranca (`start_url`) y los iconos, que están en `public/icons`. El icono marcado con `"purpose": "maskable"` es el que Android recorta con la forma que use el lanzador del teléfono, y por eso su dibujo va reducido sobre un fondo a sangre. En `index.html` un `<link rel="manifest">` lo enlaza, y un `<meta name="theme-color">` fija el color que el navegador aplica a su propia interfaz mientras la aplicación está abierta.

### El service worker

`public/sw.js` es un script que corre en su propio hilo, sin acceso al DOM, y que el navegador conserva entre visitas. Queda situado entre la aplicación y la red: toda petición que sale del documento pasa por su evento `fetch`, y ahí se decide qué se responde desde el caché y qué se pide a la red.

Su ciclo de vida tiene tres momentos, y los tres están en el archivo:

* `install` se ejecuta una vez por versión del service worker. Aquí se guarda el _app shell_, es decir, los archivos mínimos para que la aplicación pueda abrirse: `index.html`, el manifiesto, los iconos y el bundle de Javascript.
* `activate` es el momento de la limpieza. Recorre los cachés que existan y borra los que no correspondan a la versión vigente, declarada en la constante `CACHE`. Al cambiar ese nombre se fuerza un precacheo completo y se descartan los archivos de la versión anterior.
* `fetch` intercepta las peticiones, una por una.

El nombre del bundle incluye un hash de su contenido y cambia en cada `yarn build`, así que no se puede escribir a mano en la lista de precacheo. Para resolverlo, `vite.config.js` activa `build.manifest`, que deja en `dist/assets-manifest.json` la lista de los archivos generados con sus nombres definitivos, y el service worker la lee al instalarse. Las herramientas de producción, como Workbox, resuelven esto igual, con la diferencia de que inyectan la lista dentro del service worker durante el build.

En el evento `fetch` conviven dos estrategias de caché:

* **Red primero**, para la navegación. El usuario ve siempre la versión más reciente de la aplicación, y solo cuando la red falla se sirve el `index.html` guardado. Esto es además lo que permite abrir `/search` sin conexión, porque esa ruta la resuelve el router dentro del navegador y no existe como archivo en el servidor.
* **Caché primero**, para el bundle, los iconos y las tipografías de Google. Esas URLs devuelven siempre el mismo contenido, de modo que consultar la red teniéndolas guardadas sería trabajo perdido.

Las peticiones a Open-Meteo quedan deliberadamente fuera, y el service worker las deja pasar sin tocarlas. Si las respondiera desde el caché, la aplicación recibiría una temperatura sin manera de saber si es de ahora o de anteayer, y esa hora es justamente lo que queremos mostrar en pantalla.

El registro está en `src/registerServiceWorker.js` y ocurre solo en la aplicación construida. En `yarn dev`, Vite sirve cada módulo por separado, y un caché en el medio dejaría al navegador con versiones viejas del código.

### El caché de los datos

`src/api/weatherCache.js` guarda en `localStorage` la última lectura de **cada ciudad** junto con la hora en que se obtuvo. La clave se deriva del nombre de la ciudad con el prefijo `weather:`, de modo que un usuario con cinco favoritos termina con cinco entradas independientes. Son tres funciones:

* `saveWeather(city, weather)` guarda la lectura junto con `Date.now()`.
* `loadWeather(city)` la recupera, validando la forma de lo que encontró.
* `formatSavedAt(savedAt)` expresa la antigüedad en palabras —"hace 5 minutos", "hoy a las 14:32", "el 3 de septiembre, 08:15"— usando `Intl.RelativeTimeFormat` e `Intl.DateTimeFormat`.

Que la antigüedad se guarde **por ciudad** es lo que hace posible el mensaje de cada tarjeta. La barra de `ConnectionStatus` puede decir que no hay conexión, pero no puede decir de cuándo es cada dato, porque cada uno se obtuvo en un momento distinto.

Todos los accesos van dentro de un `try`, porque en modo privado o con el almacenamiento bloqueado por el usuario `localStorage` lanza una excepción al usarse.

### El estado de la conexión: anatomía del hook `useConnectionStatus`

`src/hooks/useConnectionStatus.js` es el hook propio del proyecto. Conviene leerlo con detalle, porque el patrón reaparece en cualquier aplicación que tenga que reaccionar a algo que ocurre fuera de React.

Devuelve uno de tres valores: `'offline'`, `'reconnected'` y `'online'`. El valor intermedio existe para poder avisar **una sola vez** que la red volvió, y se consume llamando a `acknowledge()`.

**El estado inicial**

```es6
const [status, setStatus] = useState(() => (navigator.onLine ? 'online' : 'offline'));
```

El estado arranca leyendo el valor actual del navegador, porque la aplicación puede cargarse cuando ya no hay conexión. Lo que recibe `useState` es un _inicializador diferido_: una función que React llama solo en el primer render. Acá `useState(navigator.onLine ? 'online' : 'offline')` daría el mismo resultado, ya que leer esa propiedad es instantáneo. La forma con función se usa cuando calcular el valor inicial cuesta caro, para que ese cálculo no se repita en cada render.

**La suscripción y su limpieza**

```es6
useEffect(() => {
  const goOffline = () => setStatus('offline');
  const goOnline = () => setStatus('reconnected');

  window.addEventListener('offline', goOffline);
  window.addEventListener('online', goOnline);

  return () => {
    window.removeEventListener('offline', goOffline);
    window.removeEventListener('online', goOnline);
  };
}, []);
```

La lista de dependencias vacía indica que la suscripción ocurre una sola vez, al montar el componente. El `return` es la parte que más se olvida: sin él, cada montaje dejaría un listener escuchando para siempre.

Fíjate además en que los manejadores se guardan en constantes. `addEventListener` y `removeEventListener` tienen que recibir exactamente la misma referencia para que el segundo deshaga lo que hizo el primero; con dos funciones anónimas escritas por separado, la limpieza se ejecutaría sin efecto alguno.

**La función que se devuelve**

```es6
const acknowledge = useCallback(() => setStatus('online'), []);

return [status, acknowledge];
```

`acknowledge` existe porque el valor `'reconnected'` hay que consumirlo: `ConnectionStatus` lo usa para cerrar la notificación y dejar el estado en `'online'`. Va envuelto en `useCallback` para que sea la misma función entre renders, algo que importa cuando se la pasa como prop a un componente o cuando se la nombra en una lista de dependencias.

El hook devuelve un arreglo, siguiendo la convención de `useState`, y así quien lo llama les pone a las dos posiciones el nombre que quiera.

**Los tres consumidores**

`ConnectionStatus` muestra el aviso. `Weather` y `Search` usan el estado como dependencia de su `useEffect`, y de ahí sale la recuperación automática: al volver la conexión los efectos se ejecutan otra vez y consultan la API. Si cada uno de los tres declarara su propia variable de estado y su propio efecto con los dos `addEventListener` y los dos `removeEventListener`, el mismo bloque quedaría escrito tres veces.

Recuerda el punto de la sección teórica: las tres llamadas tienen **estado independiente**. Se mantienen coordinadas porque las tres escuchan los mismos eventos del navegador.

**Una advertencia sobre `navigator.onLine`**

Conviene saber que `navigator.onLine` no da para más que un aviso: informa si el equipo tiene una interfaz de red activa, y puede decir `true` estando conectado a un router sin salida a Internet. En esta aplicación cumple el papel de aviso en pantalla, y la decisión de recurrir al caché la toma `Weather` cuando una petición **falla de verdad**, es decir, cuando `weatherApi` lanza un `NetworkError`.

### Cómo decide `Weather` qué mostrar

Con las piezas anteriores en su lugar, la lógica del componente se lee sola:

```es6
const temps = await fetchWeather(location);
// ...
} catch (e) {
  const cached = e instanceof NetworkError ? loadWeather(location) : null;

  if (cached) {
    setWeather(cached.weather);
    setSavedAt(cached.savedAt);
  } else if (e instanceof NetworkError) {
    setError('Sin conexión, y no hay información guardada de esta ciudad.');
  } else {
    setError('No se pudo cargar el clima.');
  }
}
```

Hay tres desenlaces posibles ante una falla, y cada uno le dice al usuario algo distinto y accionable: *esto es lo último que supimos, de tal hora*; *no hay conexión y nunca guardamos esta ciudad*; o *algo salió mal por otro motivo*. Cuando la petición sí tiene éxito, `saveWeather` deja la lectura guardada para la próxima vez, y `savedAt` vuelve a `null` para que la línea de antigüedad desaparezca.

### Cómo probarlo

El service worker no corre en modo desarrollo, de manera que hay que construir la aplicación y servirla:

```sh
yarn build      # o npm run build
yarn preview    # o npm run preview
```

Las herramientas de desarrollo organizan esto de manera distinta en cada navegador, así que conviene ubicar primero los tres lugares que vamos a usar:

| qué necesitamos | Chrome y Edge | Firefox |
| --- | --- | --- |
| cortar la conexión | Application, sección Service Workers, casilla Offline | Red, menú de _throttling_, preset Offline |
| archivos que guardó el service worker | Application, Cache Storage | Almacenamiento, Cache Storage |
| datos que guardó la aplicación | Application, Local Storage | Almacenamiento, Local Storage |

Firefox también tiene un panel Application, donde se ve el service worker registrado y la validación del manifiesto, pero el corte de conexión se hace desde el panel de red.

Con la aplicación abierta en [http://localhost:4173/](http://localhost:4173/), agrega dos o tres ciudades desde **Buscar**, espera a que las tarjetas de **Inicio** carguen su clima, y sigue estos pasos:

1. Revisa lo que quedó guardado. En Cache Storage, bajo `weather-app-v1`, están los archivos de la aplicación. En Local Storage están `WeatherApp/Favorites`, `WeatherApp/Search/KeywordList`, y una entrada `weather:<ciudad>` por cada tarjeta que alcanzó a cargar.
2. Corta la conexión y recarga. La aplicación se abre completa desde el caché, aparece la barra de aviso, y cada tarjeta muestra su clima con la hora de su última actualización. Fíjate en que las horas pueden diferir entre tarjetas.
3. Sin restablecer la conexión, entra a **Buscar** y busca una ciudad nueva. Aparece el mensaje que explica que no es posible geocodificar sin red: es el `NetworkError` llegando hasta el componente.
4. Restablece la conexión y observa la notificación de recuperación, y cómo las tarjetas consultan la API de nuevo por sí solas y pierden su línea de antigüedad.
5. Agrega una ciudad nueva a favoritos, córtale la conexión **antes** de que alcance a cargar (o borra su entrada de Local Storage y recarga sin red) para ver el caso en que no hay nada guardado que mostrar.

Dos advertencias antes de partir. En una ventana privada de Firefox los service workers están deshabilitados, de modo que la aplicación se comportará como si no hubiera caché, sin ninguna explicación en pantalla; usa una ventana normal. Y la instalación la ofrecen en el escritorio solo Chrome y Edge, desde el icono que aparece en la barra de direcciones: al instalarla podrás comprobar que abre en su propia ventana, sin barra del navegador. Firefox de escritorio no instala PWAs, y en Firefox para Android la opción está en el menú, como «Agregar a la pantalla de inicio».

Un último detalle de Firefox, para que no te haga perder tiempo: cuando una petición a Open-Meteo no llega a destino, su consola lo reporta como «CORS request did not succeed», con estado nulo. Así describe Firefox una petición que falló sin obtener respuesta, y es el mismo caso que `weatherApi.js` reconoce como `NetworkError`.

## Experimenta con el código

1. En el componente `Search`, agrega un botón para limpiar el historial de búsqueda, que aparezca desplegado únicamente si hay contenido en la lista guardada en local storage.
2. También en `Search`, identifica los posibles estados según las variables, define una función reductora con todos los casos (estados) relevantes que hayas podido identificar, y usa un reducer para mantener el estado del componente. Hint: `START_SEARCH`, `SEARCH_SUCCESS`, `SEARCH_ERROR`, `NETWORK_ERROR`, `RESET`.
3. Escribe tu propio hook. Extrae de `Weather` toda la lógica de "pedir el clima de una ciudad, guardarlo, y recurrir a lo guardado si no hay red" a un hook `useWeather(location)` que devuelva `{ weather, savedAt, loading, error }`. El componente debería quedarse solo con el JSX. Fíjate en que el hook nuevo llamará a `useConnectionStatus`: los hooks se componen entre sí igual que las funciones.
4. Haz que la línea de antigüedad se actualice sola. Hoy `formatSavedAt` se evalúa una sola vez, cuando el componente se renderiza, de modo que un "hace instantes" puede quedar congelado en pantalla varios minutos. Agrega un hook `useNow(intervalo)` que devuelva la hora actual y se actualice con `setInterval`; acuérdate de la función de limpieza.
5. Cambia la versión del caché. Modifica la constante `CACHE` en `public/sw.js`, reconstruye, y observa en Cache Storage cómo el service worker nuevo precachea todo otra vez y borra el caché anterior en su evento `activate`.
6. Rompe el service worker a propósito. Quita el `if (url.hostname.endsWith('open-meteo.com')) return;` del evento `fetch` y agrega Open-Meteo a la estrategia de caché primero. Verás que la aplicación sigue mostrando datos sin conexión, pero ya no puede decir de cuándo son, y con el tiempo mostrará temperaturas viejas sin avisar. Es un buen recordatorio de por qué los datos y los archivos se cachean en lugares distintos.
7. Ajusta los estilos de la aplicación variando colores en `src/theme.js`, y recuerda que el `theme_color` del manifiesto y el `<meta name="theme-color">` de `index.html` deberían acompañar ese cambio.

## Anexo: Lo básico de Vite

Usamos Vite (https://vitejs.dev/) como andamiaje para crear nuestra aplicación utilizando React 19. Vite provee una serie de herramientas, por ejemplo, generadores parecidos a los que tiene una aplicación Rails, que permiten crear una aplicación de frontend a partir de cero, y preparar una aplicación para producción.

Si abres el archivo `package.json` verás que hay un objeto con clave `"scripts"` declarado. Este objeto define varias tareas posibles de realizar utilizando Vite, invocándolas con Yarn según nuestras preferencias de ambiente de desarrollo.

Los scripts relevantes son:

* `dev`: Permite levantar la aplicación en modo desarrollo como hemos visto arriba.
* `build`: Prepara la aplicación para ponerla en ambiente de producción.
* `lint`: Ejecuta linters para validar que el código cumpla estándares de codificación, y normas de calidad.
* `preview`: Permite previsualizar la aplicación después que ha sido construida con `build`.

En `vite.config.js` hay una única opción agregada respecto de la configuración por defecto: `build.manifest`, que deja en `dist/assets-manifest.json` la lista de archivos generados con sus nombres definitivos. Es la lista que el service worker lee al instalarse, como se explicó más arriba.
