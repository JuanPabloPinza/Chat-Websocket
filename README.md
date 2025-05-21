# Chat-Websocket

Una aplicación de chat en tiempo real con capacidad de creación dinámica de salas, construida utilizando tecnología WebSocket.

## Descripción

Este proyecto implementa un sistema de chat en tiempo real que permite a los usuarios crear y unirse a salas de chat de manera dinámica. Cada sala está identificada por un PIN único de 6 dígitos y puede tener un límite configurable de participantes. La aplicación utiliza WebSockets para la comunicación instantánea entre usuarios, proporcionando una experiencia fluida sin necesidad de recargar la página.

## Estructura del Proyecto

### Frontend

El frontend está desarrollado con React y TypeScript, utilizando hooks modernos para la gestión del estado:

- **Componentes principales**:
  - `App.tsx`: Componente principal que gestiona la vista del lobby y del chat según el estado.
  - `index.tsx`: Punto de entrada que carga los recursos CSS y monta el componente principal.

- **Características clave**:
  - Creación y unión dinámica a salas
  - Mensajería en tiempo real
  - Identificación de usuario vía UUID
  - Diseño responsive con componentes de PrimeReact

### Backend

El backend está construido con Node.js y Express, utilizando Socket.IO para la comunicación mediante WebSocket:

- **Componentes principales**:
  - `index.js`: Configuración del servidor, manejo de eventos de Socket.IO y lógica de gestión de salas.

- **Características clave**:
  - Creación de salas con PINs únicos
  - Seguimiento de usuarios y gestión de salas
  - Difusión de mensajes en tiempo real
  - Manejo de conexiones y errores

> 💡 **Sugerencia:** Se recomienda instalar y usar `nodemon` durante el desarrollo para reiniciar automáticamente el servidor al detectar cambios:

```bash
npm install -g nodemon
nodemon index.js
```

## Tecnologías Utilizadas

### Frontend
- **React** 19.1.0
- **TypeScript** 4.9.5
- **Socket.IO Client** 4.8.1
- **PrimeReact** 10.9.5 (componentes UI)
- **UUID** 11.1.0 (para identificación de dispositivo)

### Backend
- **Node.js** con **Express**
- **Socket.IO** (servidor)
- **CORS** middleware

## Instalación y Configuración

### Requisitos Previos
- Node.js (versión 14 o superior)
- npm o yarn

### Configuración del Backend

1. Navega al directorio del backend:
   ```
   cd backend
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Inicia el servidor:
   ```
   node index.js
   ```

   💡 **Sugerencia:** Para desarrollo, se recomienda usar `nodemon` para reiniciar automáticamente el servidor al hacer cambios:
   ```
   npm install -g nodemon
   nodemon index.js
   ```

   El servidor se ejecutará por defecto en el puerto `3001`.

### Configuración del Frontend

1. Navega al directorio del frontend:
   ```
   cd chat-frontend-ts
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Inicia el servidor de desarrollo:
   ```
   npm start
   ```

   La aplicación estará disponible en: [http://localhost:3000](http://localhost:3000)

## Cómo Usar el Sistema

### Flujo de Conexión

1. Al abrir la aplicación, se intentará conectar automáticamente al servidor WebSocket.
2. Se genera un ID de dispositivo (UUID) y se almacena en el navegador.
3. Una vez conectado, se mostrará el lobby para crear o unirse a una sala.

### Crear una Sala

1. En el lobby, haz clic en **"Crear nueva sala"**.
2. Establece el número máximo de participantes (entre 1 y 20).
3. Haz clic en **"Crear Sala"**.
4. Se generará un PIN único de 6 dígitos.
5. Ingresarás automáticamente a la sala de chat.

### Unirse a una Sala

1. En el lobby, selecciona **"Unirse a sala existente"**.
2. Ingresa el PIN de 6 dígitos de la sala.
3. Haz clic en **"Unirse"**.
4. Si la sala existe y tiene espacio, ingresarás a ella.

### Uso del Chat

- El PIN de la sala se muestra en la parte superior.
- Se indica el número de participantes (ej. "Participantes: 2/5").
- Escribe mensajes y presiona Enter o haz clic en **"Enviar"**.
- Tus mensajes aparecen a la derecha; los de otros, a la izquierda.
- Los mensajes del sistema (ingresos/salidas) aparecen centrados.
- La lista de usuarios conectados se muestra a la derecha.
- Puedes salir de la sala con el botón **"Salir de la Sala"**.

### Restricciones del Sistema

- No se pueden crear salas con menos de 1 participante.
- No puedes unirte a una sala inexistente.
- No puedes unirte a una sala llena.
- No puedes estar en varias salas desde el mismo dispositivo.
- No se permiten mensajes vacíos.

## Resolución de Problemas

- Si ves un error de conexión, verifica que el backend esté en ejecución.
- Si no puedes unirte a una sala, asegúrate de que el PIN sea correcto y haya espacio disponible.
- Si los mensajes no se envían, revisa tu conexión al servidor.
- Si fuiste desconectado, el servidor podría haberse reiniciado o la sala cerró.


## Contribuidores

- Ansatuña Andrade Karla Alejandra
- Pinza Armijos Juan Pablo
- Trejo Duque Alex Fernando
