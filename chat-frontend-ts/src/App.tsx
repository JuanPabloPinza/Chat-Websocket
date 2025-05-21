// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Socket, io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// Componentes de PrimeReact
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber, InputNumberValueChangeEvent } from 'primereact/inputnumber';
import { Card } from 'primereact/card';
import { Toast } from 'primereact/toast'; // No se importa ToastMessage directamente usualmente
import { ScrollPanel } from 'primereact/scrollpanel';
import { Message } from 'primereact/message';

import './App.css';

// URL del servidor de Sockets, obtenida de variables de entorno o valor por defecto
const URL_SERVIDOR_SOCKET = process.env.REACT_APP_SOCKET_SERVER_URL || 'http://localhost:3001';

// --- Interfaces para Tipado ---
interface MensajeChat { // Anteriormente ChatMessage
  user: string; // 'usuario' podría ser, pero 'user' es muy estándar
  text: string; // 'texto'
  timestamp?: string; // 'marcaDeTiempo'
  type?: 'system' | 'user' | 'own'; // 'tipo': 'sistema', 'usuario', 'propio'
}

interface DetallesSala { // Anteriormente RoomDetails
  pin: string;
  limit: number; // 'limite'
  participantsCount: number; // 'contadorParticipantes'
  users: string[]; // 'usuarios'
}

// Payloads de eventos (opcional pero bueno para la claridad)
interface PayloadEntradaSala { // Anteriormente JoinedRoomPayload
  pin: string;
  limit: number;
  participantsCount: number;
  isCreator: boolean; // 'esCreador'
}
interface PayloadActualizacionSala { // Anteriormente RoomUpdatePayload
  participantsCount: number;
  users: string[];
}
interface PayloadNuevoMensaje { // Anteriormente NewMessagePayload
  user: string;
  text: string;
  timestamp: string;
}
interface PayloadError { // Anteriormente ErrorPayload
  message: string; // 'mensaje'
}
interface PayloadFeedbackSalidaSala { // Anteriormente LeftRoomFeedbackPayload
  message: string;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [idDispositivo, setIdDispositivo] = useState<string>(''); // Anteriormente deviceId

  const [pinSala, setPinSala] = useState<string>(''); // Anteriormente roomPIN
  const [pinEntrada, setPinEntrada] = useState<string>(''); // Anteriormente inputPIN
  const [limiteSalaEntrada, setLimiteSalaEntrada] = useState<number>(5); // Anteriormente roomLimitInput

  const [enSala, setEnSala] = useState<boolean>(false); // Anteriormente inRoom
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]); // Anteriormente messages
  const [entradaNuevoMensaje, setEntradaNuevoMensaje] = useState<string>(''); // Anteriormente newMessageInput
  const [detallesSalaActual, setDetallesSalaActual] = useState<DetallesSala | null>(null); // Anteriormente currentRoomDetails

  const refToast = useRef<Toast>(null); // Anteriormente toastRef
  const refFinMensajes = useRef<HTMLDivElement | null>(null); // Anteriormente messagesEndRef
  const [errorEnLinea, setErrorEnLinea] = useState<string | null>(null); // Anteriormente inlineError


  // Efecto para inicializar ID de Dispositivo y Socket
  useEffect(() => {
    let idDispositivoAlmacenado = localStorage.getItem('deviceId'); // Mantenemos 'deviceId' como clave en localStorage por consistencia si otras apps lo usan
    if (!idDispositivoAlmacenado) {
      idDispositivoAlmacenado = uuidv4();
      localStorage.setItem('deviceId', idDispositivoAlmacenado);
    }
    setIdDispositivo(idDispositivoAlmacenado);

    const nuevoSocket = io(URL_SERVIDOR_SOCKET, {
      // Opciones adicionales si son necesarias
    });
    setSocket(nuevoSocket);

    nuevoSocket.on('connect', () => {
      console.log('Conectado al servidor con ID:', nuevoSocket.id);
      refToast.current?.show({ severity: 'success', summary: 'Conectado', detail: '¡Conectado exitosamente al servidor de chat!', life: 3000 });
    });

    nuevoSocket.on('error', (err: PayloadError) => {
      console.error('Error de Socket:', err);
      const mensajeError = err.message || 'Ocurrió un error desconocido.';
      setErrorEnLinea(mensajeError);
      refToast.current?.show({ severity: 'error', summary: 'Error', detail: mensajeError, life: 5000 });
      if (mensajeError.includes("not in this room") || mensajeError.includes("Room not found") || mensajeError.includes("Sala no encontrada")) { // Añadido mensaje en español
        manejarEstadoLocalSalidaSala();
      }
    });

    nuevoSocket.on('joinedRoom', (data: PayloadEntradaSala) => { // 'salaUnida'
      setEnSala(true);
      setPinSala(data.pin);
      setDetallesSalaActual({
        pin: data.pin,
        limit: data.limit,
        participantsCount: data.participantsCount,
        users: [] // Se llenará con 'actualizacionSala'
      });
      setMensajes([]); // Limpiar mensajes de salas anteriores
      setErrorEnLinea(null); // Limpiar errores en línea
      const mensajeUnion = data.isCreator
        ? `Has creado la sala ${data.pin}. PIN: ${data.pin}`
        : `Te has unido a la sala ${data.pin}.`;
      setMensajes(prev => [...prev, { user: 'Sistema', text: mensajeUnion, type: 'system' }]); // 'Sistema' en vez de 'System'
      refToast.current?.show({ severity: 'info', summary: 'Entraste a la Sala', detail: `Has entrado a la sala ${data.pin}`, life: 3000 });
    });

    nuevoSocket.on('roomUpdate', (data: PayloadActualizacionSala) => { // 'actualizacionSala'
      setDetallesSalaActual(prev => prev ? { ...prev, participantsCount: data.participantsCount, users: data.users || [] } : null);
    });

    nuevoSocket.on('newMessage', (message: PayloadNuevoMensaje) => { // 'nuevoMensaje'
      // Comparar con idDispositivo directamente
      setMensajes(prev => [...prev, { ...message, type: message.user === idDispositivo.substring(0, 6) + "..." ? 'own' : 'user' }]);
    });

    nuevoSocket.on('leftRoomFeedback', (data: PayloadFeedbackSalidaSala) => { // 'feedbackSalidaSala'
      manejarEstadoLocalSalidaSala();
      refToast.current?.show({ severity: 'info', summary: 'Saliste de la Sala', detail: data.message || 'Has salido de la sala.', life: 3000 });
    });

    // Función de limpieza al desmontar el componente
    return () => {
      nuevoSocket.off('connect');
      nuevoSocket.off('error');
      nuevoSocket.off('joinedRoom'); // 'salaUnida'
      nuevoSocket.off('roomUpdate'); // 'actualizacionSala'
      nuevoSocket.off('newMessage'); // 'nuevoMensaje'
      nuevoSocket.off('leftRoomFeedback'); // 'feedbackSalidaSala'
      nuevoSocket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo se ejecuta una vez al montar

  // Efecto para auto-scroll de mensajes
  useEffect(() => {
    refFinMensajes.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Restablece el estado local relacionado con estar en una sala
  const manejarEstadoLocalSalidaSala = () => { // Anteriormente handleLocalLeaveRoomState
    setEnSala(false);
    setPinSala('');
    setMensajes([]);
    setDetallesSalaActual(null);
  };

  // Maneja la creación de una nueva sala
  const manejarCrearSala = () => { // Anteriormente handleCreateRoom
    console.log('Llamada a manejarCrearSala');
    console.log('Socket conectado?', socket?.connected);
    console.log('Instancia de Socket:', socket);
    console.log('ID de Dispositivo:', idDispositivo);
    console.log('Límite de Sala (entrada):', limiteSalaEntrada);

    if (socket && idDispositivo && limiteSalaEntrada > 0) {
      setErrorEnLinea(null);
      console.log('Emitiendo evento crearSala...');
      socket.emit('createRoom', { limit: limiteSalaEntrada, deviceId: idDispositivo }); // 'createRoom' es el evento del backend
    } else if (limiteSalaEntrada <= 0) {
      refToast.current?.show({ severity: 'warn', summary: 'Límite Inválido', detail: 'El límite de la sala debe ser mayor que 0.', life: 3000 });
    } else {
      console.error('No se puede crear la sala. Falta socket o ID de dispositivo, o el límite es inválido.');
      refToast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo crear la sala. Verifica la conexión o el ID de Dispositivo.', life: 3000 });
    }
  };

  // Maneja la unión a una sala existente
  const manejarUnirseSala = () => { // Anteriormente handleJoinRoom
    if (socket && pinEntrada.trim() && idDispositivo) {
      setErrorEnLinea(null);
      socket.emit('joinRoom', { pin: pinEntrada.trim(), deviceId: idDispositivo }); // 'joinRoom' es el evento del backend
    } else {
      refToast.current?.show({ severity: 'warn', summary: 'Entrada Requerida', detail: 'Por favor, ingresa un PIN de sala.', life: 3000 });
    }
  };

  // Maneja el envío de un nuevo mensaje
  const manejarEnviarMensaje = (e?: React.FormEvent<HTMLFormElement>) => { // Anteriormente handleSendMessage
    e?.preventDefault();
    if (socket && entradaNuevoMensaje.trim() && pinSala && idDispositivo) {
      socket.emit('sendMessage', { pin: pinSala, message: entradaNuevoMensaje.trim(), deviceId: idDispositivo }); // 'sendMessage' es el evento del backend
      setEntradaNuevoMensaje('');
    }
  };

  // Maneja la salida de la sala actual
  const manejarSalirSala = () => { // Anteriormente handleLeaveRoom
    if (socket && pinSala) {
      socket.emit('leaveRoom'); // 'leaveRoom' es el evento del backend
      // El estado se limpiará con 'feedbackSalidaSala'
    }
  };

  // Vista para cuando el usuario no está en una sala (lobby)
  const vistaLobby = ( // Anteriormente lobbyView
    <div className="p-grid p-justify-center p-mt-5">
      <div className="p-col-12 p-md-6 p-lg-4">
        <Card title="Crear Nueva Sala" subTitle="Inicia una sesión de chat">
          <div className="p-fluid">
            <div className="p-field p-mb-3">
              <label htmlFor="limiteSala" className="p-d-block p-mb-1">Máx. Participantes</label>
              <InputNumber id="limiteSala" value={limiteSalaEntrada} onValueChange={(e: InputNumberValueChangeEvent) => setLimiteSalaEntrada(e.value ?? 1)} min={1} max={20} showButtons />
            </div>
            <Button label="Crear Sala" icon="pi pi-plus" onClick={manejarCrearSala} disabled={!socket || !idDispositivo} />
          </div>
        </Card>
      </div>
      <div className="p-col-12 p-md-6 p-lg-4">
        <Card title="Unirse a Sala Existente" subTitle="Ingresa un PIN de Sala">
          <div className="p-fluid">
            <div className="p-field p-mb-3">
              <label htmlFor="pinEntrada" className="p-d-block p-mb-1">PIN de Sala</label>
              <InputText id="pinEntrada" value={pinEntrada} onChange={(e) => setPinEntrada(e.target.value)} placeholder="PIN de 6 dígitos" maxLength={6} />
            </div>
            <Button label="Unirse a Sala" icon="pi pi-sign-in" onClick={manejarUnirseSala} disabled={!socket || !idDispositivo || !pinEntrada.trim()} />
          </div>
        </Card>
      </div>
      {idDispositivo && <div className="p-col-12 p-text-center p-mt-3"><small>Tu ID de Dispositivo: {idDispositivo.substring(0, 12)}...</small></div>}
    </div>
  );

  // Vista para cuando el usuario está dentro de una sala de chat
  const vistaSalaChat = ( // Anteriormente chatRoomView
    <div className="chat-room-container p-card p-p-3 p-d-flex p-flex-column">
      <div className="p-d-flex p-flex-column p-sm-flex-row p-jc-between p-ai-center p-mb-3">
        <h2 className="room-title p-mb-2 p-sm-mb-0">
          PIN de Sala: <span className="room-pin-highlight">{pinSala}</span>
        </h2>
        {detallesSalaActual && (
          <p className="p-m-0 participants-info">
            Participantes: {detallesSalaActual.participantsCount} / {detallesSalaActual.limit}
          </p>
        )}
      </div>

      <div className="p-grid chat-layout-grid">
        <div className="p-col-12 p-md-8 p-lg-9 p-order-2 p-md-order-1 chat-messages-section">
          <ScrollPanel
            className="messages-area p-p-2"
            style={{ width: '100%', height: 'calc(100vh - 320px)' }} // Ajusta este valor según sea necesario
          >
            {mensajes.map((msg, index) => (
              <div key={index} className={`message-bubble message-${msg.type || 'user'}`}>
                {msg.type !== 'own' && msg.type !== 'system' && <strong className="message-user-name">{msg.user}: </strong>}
                {msg.text}
                {msg.timestamp && <span className="timestamp"> ({msg.timestamp})</span>}
              </div>
            ))}
            <div ref={refFinMensajes} />
          </ScrollPanel>
          <form onSubmit={manejarEnviarMensaje} className="p-d-flex p-mt-2 message-input-form">
            <InputText
              value={entradaNuevoMensaje}
              onChange={(e) => setEntradaNuevoMensaje(e.target.value)}
              placeholder="Escribe un mensaje..." // Placeholder en español
              className="p-mr-2 p-inputtext-lg"
              style={{ flexGrow: 1 }}
              onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); manejarEnviarMensaje(); } }}
            />
            <Button type="submit" icon="pi pi-send" className="p-button-lg" label="Enviar" disabled={!entradaNuevoMensaje.trim()} /> {/* Label en español */}
          </form>
        </div>

        <div className="p-col-12 p-md-4 p-lg-3 p-order-1 p-md-order-2 chat-sidebar-section">
          {detallesSalaActual && detallesSalaActual.users && (
            <Card title="Usuarios en Línea" className="p-mb-3 user-list-card"> {/* Título en español */}
              <ScrollPanel style={{ width: '100%', maxHeight: '200px' }}>
                <ul className="p-list-none p-p-0 p-m-0">
                  {detallesSalaActual.users.map(nombreUsuario => ( // 'user' cambiado a 'nombreUsuario' para claridad en el map
                    <li key={nombreUsuario} className="p-py-2 p-px-1 user-list-item p-d-flex p-ai-center">
                      <i className="pi pi-user p-mr-2"></i>
                      <span className="p-text-truncate" style={{ maxWidth: '150px' }}>{nombreUsuario.substring(0, 8)}...</span>
                      {/* Comparar con idDispositivo directamente */}
                      {nombreUsuario === idDispositivo && <span className="p-ml-auto p-tag p-tag-info p-p-1" style={{ fontSize: '0.8em' }}>Tú</span>}
                    </li>
                  ))}
                </ul>
              </ScrollPanel>
            </Card>
          )}
          <Button
            label="Salir de Sala" // Label en español
            icon="pi pi-sign-out"
            className="p-button-danger p-button-lg p-mt-auto"
            onClick={manejarSalirSala}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </div>
  );


  return (
    <div className="App p-d-flex p-flex-column p-ai-center" style={{ minHeight: '100vh' }}>
      <Toast ref={refToast} />
      <div className="p-col-12 p-lg-10 p-xl-8" style={{ width: '100%' }}>
        <div className="p-text-center p-mb-4 p-mt-3">
          <h1 className="app-title">Chat en Tiempo Real con PrimeReact</h1> {/* Título en español */}
        </div>

        {errorEnLinea && (
          <div className="p-mb-3 p-d-flex p-jc-center">
            <Message severity="error" text={errorEnLinea} style={{ width: 'auto' }} />
          </div>
        )}

        {!socket && (
          <div className="p-text-center p-mt-5">
            <i className="pi pi-spin pi-spinner" style={{ 'fontSize': '3em' }}></i>
            <p>Conectando al servidor...</p> {/* Mensaje en español */}
          </div>
        )}
        {socket && (!enSala ? vistaLobby : vistaSalaChat)}
      </div>
    </div>
  );
}

export default App;