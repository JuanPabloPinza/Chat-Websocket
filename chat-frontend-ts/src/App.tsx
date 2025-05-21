import React, { useState, useEffect, useRef } from 'react';
import { Socket, io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

// Componentes de PrimeReact
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber, InputNumberValueChangeEvent } from 'primereact/inputnumber';
import { Card } from 'primereact/card';
import { Toast } from 'primereact/toast';
import { ScrollPanel } from 'primereact/scrollpanel';
import { Message } from 'primereact/message';

import './App.css';

// URL del servidor de Sockets, obtenida de variables de entorno o valor por defecto
const URL_SERVIDOR_SOCKET = process.env.REACT_APP_SOCKET_SERVER_URL || 'http://localhost:3001';

// --- Interfaces para Tipado ---
interface MensajeChat {
  user: string;
  text: string;
  timestamp?: string;
  type?: 'system' | 'user' | 'own';
}

interface DetallesSala {
  pin: string;
  limit: number;
  participantsCount: number;
  users: string[];
}

interface PayloadEntradaSala {
  pin: string;
  limit: number;
  participantsCount: number;
  isCreator: boolean;
}
interface PayloadActualizacionSala {
  participantsCount: number;
  users: string[];
}
interface PayloadNuevoMensaje {
  user: string;
  text: string;
  timestamp: string;
}
interface PayloadError {
  message: string;
}
interface PayloadFeedbackSalidaSala {
  message: string;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [idDispositivo, setIdDispositivo] = useState<string>('');

  const [pinSala, setPinSala] = useState<string>('');
  const [pinEntrada, setPinEntrada] = useState<string>('');
  const [limiteSalaEntrada, setLimiteSalaEntrada] = useState<number>(5);

  const [enSala, setEnSala] = useState<boolean>(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [entradaNuevoMensaje, setEntradaNuevoMensaje] = useState<string>('');
  const [detallesSalaActual, setDetallesSalaActual] = useState<DetallesSala | null>(null);

  const refToast = useRef<Toast>(null);
  const refFinMensajes = useRef<HTMLDivElement | null>(null);
  const [errorEnLinea, setErrorEnLinea] = useState<string | null>(null);

  // Efecto para inicializar ID de Dispositivo
  useEffect(() => {
    let idDispositivoAlmacenado = localStorage.getItem('deviceId');
    if (!idDispositivoAlmacenado) {
      idDispositivoAlmacenado = uuidv4();
      localStorage.setItem('deviceId', idDispositivoAlmacenado);
    }
    console.log('ID de Dispositivo establecido:', idDispositivoAlmacenado);
    setIdDispositivo(idDispositivoAlmacenado);
  }, []);

  // Efecto para inicializar Socket y eventos
  useEffect(() => {
    if (!idDispositivo) return; // Espera a que idDispositivo esté listo

    const nuevoSocket = io(URL_SERVIDOR_SOCKET, {});
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
      if (mensajeError.includes("not in this room") || mensajeError.includes("Room not found") || mensajeError.includes("Sala no encontrada")) {
        manejarEstadoLocalSalidaSala();
      }
    });

    nuevoSocket.on('joinedRoom', (data: PayloadEntradaSala) => {
      setEnSala(true);
      setPinSala(data.pin);
      setDetallesSalaActual({
        pin: data.pin,
        limit: data.limit,
        participantsCount: data.participantsCount,
        users: []
      });
      setMensajes([]);
      setErrorEnLinea(null);
      const mensajeUnion = data.isCreator
        ? `Has creado la sala ${data.pin}. PIN: ${data.pin}`
        : `Te has unido a la sala ${data.pin}.`;
      setMensajes(prev => [...prev, { user: 'Sistema', text: mensajeUnion, type: 'system' }]);
      refToast.current?.show({ severity: 'info', summary: 'Entraste a la Sala', detail: `Has entrado a la sala ${data.pin}`, life: 3000 });
    });

    nuevoSocket.on('roomUpdate', (data: PayloadActualizacionSala) => {
      console.log('Evento roomUpdate recibido:', data);
      setDetallesSalaActual(prev => {
        if (!prev) return prev;
        const updated = { ...prev, participantsCount: data.participantsCount, users: data.users || [] };
        console.log('Estado actualizado de detallesSalaActual:', updated);
        return updated;
      });
    });

    nuevoSocket.on('newMessage', (message: PayloadNuevoMensaje) => {
      console.log('Nuevo mensaje recibido:', message);
      console.log('Comparando message.user:', message.user, 'con idDispositivo:', idDispositivo.substring(0, 6) + "...");
      const newMessage: MensajeChat = {
        ...message,
        type: message.user === (idDispositivo ? idDispositivo.substring(0, 6) + "..." : '') ? 'own' : 'user'
      };
      setMensajes(prev => [...prev, newMessage]);
    });

    nuevoSocket.on('leftRoomFeedback', (data: PayloadFeedbackSalidaSala) => {
      manejarEstadoLocalSalidaSala();
      refToast.current?.show({ severity: 'info', summary: 'Saliste de la Sala', detail: data.message || 'Has salido de la sala.', life: 3000 });
    });

    return () => {
      nuevoSocket.off('connect');
      nuevoSocket.off('error');
      nuevoSocket.off('joinedRoom');
      nuevoSocket.off('roomUpdate');
      nuevoSocket.off('newMessage');
      nuevoSocket.off('leftRoomFeedback');
      nuevoSocket.disconnect();
    };
  }, [idDispositivo]); // Dependencia en idDispositivo

  // Efecto para auto-scroll de mensajes
  useEffect(() => {
    refFinMensajes.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Efecto para depurar cambios en la lista de usuarios
  useEffect(() => {
    console.log('Lista de usuarios actualizada:', detallesSalaActual?.users);
  }, [detallesSalaActual?.users]);

  const manejarEstadoLocalSalidaSala = () => {
    setEnSala(false);
    setPinSala('');
    setMensajes([]);
    setDetallesSalaActual(null);
  };

  const manejarCrearSala = () => {
    console.log('Llamada a manejarCrearSala');
    console.log('Socket conectado?', socket?.connected);
    console.log('Instancia de Socket:', socket);
    console.log('ID de Dispositivo:', idDispositivo);
    console.log('Límite de Sala (entrada):', limiteSalaEntrada);

    if (socket && idDispositivo && limiteSalaEntrada > 0) {
      setErrorEnLinea(null);
      console.log('Emitiendo evento crearSala...');
      socket.emit('createRoom', { limit: limiteSalaEntrada, deviceId: idDispositivo });
    } else if (limiteSalaEntrada <= 0) {
      refToast.current?.show({ severity: 'warn', summary: 'Límite Inválido', detail: 'El límite de la sala debe ser mayor que 0.', life: 3000 });
    } else {
      console.error('No se puede crear la sala. Falta socket o ID de dispositivo, o el límite es inválido.');
      refToast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo crear la sala. Verifica la conexión o el ID de Dispositivo.', life: 3000 });
    }
  };

  const manejarUnirseSala = () => {
    if (socket && pinEntrada.trim() && idDispositivo) {
      setErrorEnLinea(null);
      socket.emit('joinRoom', { pin: pinEntrada.trim(), deviceId: idDispositivo });
    } else {
      refToast.current?.show({ severity: 'warn', summary: 'Entrada Requerida', detail: 'Por favor, ingresa un PIN de sala.', life: 3000 });
    }
  };

  const manejarEnviarMensaje = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (socket && entradaNuevoMensaje.trim() && pinSala && idDispositivo) {
      const user = idDispositivo.substring(0, 6) + "...";
      socket.emit('sendMessage', { pin: pinSala, message: entradaNuevoMensaje.trim(), deviceId: idDispositivo, user });
      setEntradaNuevoMensaje('');
    }
  };

  const manejarSalirSala = () => {
    if (socket && pinSala) {
      socket.emit('leaveRoom');
    }
  };

  const vistaLobby = (
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

  const vistaSalaChat = (
    <div className="chat-room-container p-card p-p-3 p-d-flex p-flex-column">
      <div className="p-d-flex p-flex-column p-sm-flex-row p-jc-between p-ai-center p-mb-4">
        <h2 className="room-title p-mb-2 p-sm-mb-0">
          <i className="pi pi-lock p-mr-2" style={{ color: '#6b46c1' }}></i>
          PIN de Sala: <span className="room-pin-highlight">{pinSala}</span>
        </h2>
        {detallesSalaActual && (
          <p className="p-m-0 participants-info">
            <i className="pi pi-users p-mr-1"></i>
            Participantes: {detallesSalaActual.participantsCount} / {detallesSalaActual.limit}
          </p>
        )}
      </div>

      <div className="p-grid chat-layout-grid">
        <div className="p-col-12 p-md-8 p-lg-9 p-order-2 p-md-order-1 chat-messages-section">
          <ScrollPanel
            className="messages-area p-p-2"
            style={{ width: '100%', height: 'calc(100vh - 320px)' }}
          >
            {mensajes.map((msg, index) => (
              <div key={index} className={`message-bubble message-${msg.type || 'user'}`}>
                {msg.type === 'system' && (
                  <div className="p-text-center message-system">{msg.text}</div>
                )}
                {(msg.type === 'user' || msg.type === 'own') && (
                  <>
                    {msg.type === 'user' && (
                      <div className="p-d-flex p-ai-center p-mb-1">
                        <i className="pi pi-user p-mr-1" style={{ fontSize: '0.9rem', color: '#718096' }}></i>
                        <strong className="message-user-name">{msg.user}</strong>
                      </div>
                    )}
                    {msg.type === 'own' && (
                      <div className="p-d-flex p-ai-center p-mb-1 p-jc-end">
                        <span className="message-user-name p-mr-1">Tú</span>
                        <i className="pi pi-user" style={{ fontSize: '0.9rem', color: '#e9d8fd' }}></i>
                      </div>
                    )}
                    <div className={`message-content ${msg.type === 'own' ? 'message-own-content' : ''}`}>{msg.text}</div>
                    {msg.timestamp && <span className="timestamp">{msg.timestamp}</span>}
                  </>
                )}
              </div>
            ))}
            <div ref={refFinMensajes} />
          </ScrollPanel>
          <div className="p-d-flex p-mt-2 message-input-form">
            <InputText
              value={entradaNuevoMensaje}
              onChange={(e) => setEntradaNuevoMensaje(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="p-mr-2 p-inputtext-lg"
              style={{ flexGrow: 1 }}
              onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); manejarEnviarMensaje(); } }}
            />
            <Button
              icon="pi pi-send"
              className="p-button-lg"
              label="Enviar"
              disabled={!entradaNuevoMensaje.trim()}
              onClick={() => manejarEnviarMensaje()}
            />
          </div>
        </div>

        <div className="p-col-12 p-md-4 p-lg-3 p-order-1 p-md-order-2 chat-sidebar-section">
          {detallesSalaActual && detallesSalaActual.users && (
            <Card title={<span><i className="pi pi-users p-mr-2" />Usuarios en Línea</span>} className="p-mb-4 user-list-card">
              <ScrollPanel style={{ width: '100%', minHeight: '150px', maxHeight: '50vh' }}>
                <ul className="p-list-none p-p-0 p-m-0">
                  {detallesSalaActual.users.map(nombreUsuario => (
                    <li key={nombreUsuario} className="p-py-2 p-px-1 user-list-item p-d-flex p-ai-center">
                      <i className="pi pi-circle-fill p-mr-2" style={{ color: '#48bb78', fontSize: '0.8rem' }}></i>
                      <span className="p-text-truncate" style={{ maxWidth: '150px' }}>{nombreUsuario.substring(0, 8)}...</span>
                      {nombreUsuario === idDispositivo && <span className="p-ml-auto p-tag p-tag-info p-p-1" style={{ fontSize: '0.8em', backgroundColor: '#6b46c1', color: 'white' }}>Tú</span>}
                    </li>
                  ))}
                </ul>
              </ScrollPanel>
            </Card>
          )}
          <Button
            label="Salir de Sala"
            icon="pi pi-sign-out"
            className="p-button-danger p-button-lg"
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
          <h1 className="app-title">Chat en Tiempo Real con PrimeReact</h1>
        </div>

        {errorEnLinea && (
          <div className="p-mb-3 p-d-flex p-jc-center">
            <Message severity="error" text={errorEnLinea} style={{ width: 'auto' }} />
          </div>
        )}

        {!socket && (
          <div className="p-text-center p-mt-5">
            <i className="pi pi-spin pi-spinner" style={{ 'fontSize': '3em' }}></i>
            <p>Conectando al servidor...</p>
          </div>
        )}
        {socket && (!enSala ? vistaLobby : vistaSalaChat)}
      </div>
    </div>
  );
}

export default App;