// src/main.tsx o src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Puedes mantener o eliminar este si solo usas PrimeReact/PrimeFlex

// PrimeReact CSS
import "primereact/resources/themes/lara-light-indigo/theme.css";  // Elige tu tema favorito
import "primereact/resources/primereact.min.css";                  // Core CSS
import "primeicons/primeicons.css";                                // Icons
import "primeflex/primeflex.css";                                  // PrimeFlex

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);