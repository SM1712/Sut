# SUT — Sistema Universal de Tareas

> Organiza tus tareas universitarias por curso, prioridad y fecha — con sincronización en la nube.

![SUT Preview](assets/icon.svg)

## ✨ Funcionalidades

| Módulo | Descripción |
|---|---|
| **Dashboard** | Vista general con stats, tareas urgentes y resumen por curso |
| **Tareas** | CRUD completo con filtros, etiquetas, fechas y prioridades |
| **Prioridad escalante** | La prioridad sube automáticamente conforme se acerca el vencimiento |
| **Cursos** | Organiza tareas por curso con color propio |
| **Etiquetas** | Ciclos, tipos (Examen, Investigación…) con prioridad por defecto |
| **Calendario** | Vista mensual con bandas de eventos multi-día |
| **Eventos** | Semana de exámenes, exposiciones, feriados — con indicativo visual |
| **Personalización** | Tema claro/oscuro, 12 colores, 6 tipografías, escala de fuente |
| **Auth Google** | Login con Google vía Firebase para sincronizar entre dispositivos |
| **Exportar/Importar** | Backup completo en JSON |

## 🚀 Setup rápido (local)

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/SUT.git
cd SUT

# Servir localmente (requiere Node.js)
npx serve .
```

Abre `http://localhost:3000` en tu navegador.

## 🔥 Configurar Firebase

Para activar login con Google y sincronización entre dispositivos:

### 1. Crear el proyecto
1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. **Add project** → nombre: `SUT` → Continuar

### 2. Habilitar Authentication
1. Build → **Authentication** → Get started
2. Sign-in method → **Google** → Habilitar
3. Agregar tu dominio en "Authorized domains" (si usas hosting propio)

### 3. Crear Firestore
1. Build → **Firestore Database** → Create database
2. Seleccionar modo **Production**
3. Región: `us-central1`
4. **Reglas de seguridad** — pegar esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Registrar la app web
1. Project Settings (⚙) → General → **Your apps** → Web (`</>`)
2. App nickname: `SUT Web`
3. Copiar el bloque `firebaseConfig`

### 5. Agregar la config al proyecto
Editar `js/firebase-config.js`:

```js
export const firebaseConfig = {
  apiKey:            "TU_API_KEY",
  authDomain:        "TU_PROYECTO.firebaseapp.com",
  projectId:         "TU_PROYECTO_ID",
  storageBucket:     "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID",
};

export const FIREBASE_ENABLED = true; // ← cambiar a true
```

## 🐙 Subir a GitHub

```bash
git init
git add .
git commit -m "feat: SUT — Sistema Universal de Tareas v1.0"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/SUT.git
git push -u origin main
```

## 🏗️ Estructura del proyecto

```
SUT/
├── index.html              # Shell de la app
├── assets/
│   ├── icon.svg            # Ícono corporativo
│   ├── favicon.svg
│   └── logo.svg
├── css/
│   ├── variables.css       # Design tokens (colores, tipografías, etc.)
│   ├── base.css            # Reset + utilidades
│   ├── components.css      # Todos los componentes visuales
│   └── animations.css      # Keyframes y micro-interacciones
└── js/
    ├── app.js              # Punto de entrada y enrutador
    ├── store.js            # Estado global + localStorage
    ├── tasks.js            # CRUD de tareas + prioridad escalante
    ├── courses.js          # Gestión de cursos
    ├── tags.js             # Etiquetas con prioridad por defecto
    ├── calendar.js         # Vista mensual con eventos
    ├── events.js           # Eventos multi-día (semana de exámenes, etc.)
    ├── theme.js            # Personalización visual
    ├── onboarding.js       # Tutorial animado
    ├── notifications.js    # Alertas de vencimiento
    ├── search.js           # Búsqueda global
    ├── toasts.js           # Notificaciones toast
    ├── utils.js            # Helpers (fechas, prioridad escalante, etc.)
    ├── auth.js             # Firebase Authentication (Google)
    ├── sync.js             # Sincronización con Firestore
    └── firebase-config.js  # ⚠️ Tu config de Firebase aquí
```

## ⌨️ Atajos de teclado

| Atajo | Acción |
|---|---|
| `/` | Enfocar búsqueda |
| `Ctrl+N` | Nueva tarea |
| `1–5` | Cambiar de vista |
| `Esc` | Cerrar modal/drawer |

## 📄 Licencia

MIT — Libre para uso personal y académico.
