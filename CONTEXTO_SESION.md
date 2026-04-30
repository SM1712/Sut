# SUT — Contexto de sesión (continuación)

> Copia este archivo completo como primer mensaje en una nueva sesión de Claude Code.

---

## Proyecto

**SUT (Sistema Universal de Tareas)** — PWA de gestión de tareas universitarias.
Stack: **Vite 5 + React 18 + TypeScript 5 + Zustand (`subscribeWithSelector`) + Firebase 10 (Auth + Firestore) + Framer Motion + Lucide React**.
Ruta local: `C:\Users\meson\Desktop\SUT`
Firebase project: `sut1-afd4f`
Puerto dev: `5174` (vite --host)

---

## Estado del build (última compilación limpia)

```
✓ built in 3.39s
firebase-vendor: 435.75 kB  │  react-vendor: 164.21 kB
motion-vendor:  115.26 kB  │  index: 156.76 kB
PWA: 17 precached entries   │  TypeScript: 0 errors
```

---

## Arquitectura clave

| Concepto | Detalle |
|---|---|
| Persistencia local | `localStorage` key `sut.state.v2` |
| Settings | `sut.settings.v1` |
| Rutas de datos | Personal → `users/{uid}/{col}` / Espacio → `spaces/{spaceId}/{col}` |
| Auth | Firebase Auth (Google) |
| Sync en tiempo real | `onSnapshot` via `fsSubscribe()` en `src/lib/firebase.ts` |
| Gestión de listeners | `subscribeToData(uid, spaceId)` / `unsubscribeFromData()` en `src/store/sync.ts` |
| Hydration incremental | `hydrateCollection(col, items)` — actualiza una sola colección sin resetear el store |
| Notificaciones | Hook `useReminders` — polling cada 60s + `setTimeout` + `Notification` API |
| Evento FAB/TopBar | Custom DOM event `sut:new-task` |

---

## Archivos importantes y su estado

### `src/store/index.ts`
- `upsertTask`, `upsertCourse`, `upsertTag`, `upsertEvent` — sincronizan el objeto **completo** construido (con `createdAt/updatedAt`) a Firestore
- `createdBy` guarda `meta.email || meta.uid` (email preferido para mostrar en UI)
- `hydrateCollection(col, items)` — reemplaza una colección en Zustand desde snapshot Firestore

### `src/lib/firebase.ts`
- `fsSubscribe(col, uid, spaceId, onData, onError?)` — crea `onSnapshot` listener, devuelve `Unsubscribe`
- `dataPath(col, uid, spaceId)` — enruta a personal o espacio según `spaceId`
- `uploadAudio(blob, uid, spaceId, audioId)` — sube audio a Firebase Storage, devuelve download URL

### `src/store/sync.ts`
- `subscribeToData(uid, spaceId)` — destruye listeners anteriores, crea nuevos para `tasks|courses|tags|events`
- `unsubscribeFromData()` — cancela todos los listeners activos
- `initAuth()` — llama `subscribeToData` tras autenticación; `onLogout` llama `clearAuth()` (NO `clearSessionAndSpace`)
- Si `permission-denied` en listener de espacio → fallback automático a datos personales

### `src/components/spaces/SpacePanel.tsx`
- Crear espacio → `subscribeToData(uid, newCode)` + `addSpaceToHistory`
- Unirse → `subscribeToData(uid, joinCode)` + `addSpaceToHistory`
- Salir → `unsubscribeFromData()` + `setSpaceId(null)` + `subscribeToData(uid, null)` (NO limpia datos)
- Quick-switch entre espacios del historial (`spaceHistory`)
- Indicador "En vivo" con animación `pulse-green`
- Info box de qué se comparte (tareas, cursos, etiquetas, calendario)

### `src/components/account/AccountPanel.tsx`
- Mobile: bottom-sheet; Desktop: dropdown fixed top-right (top:56, right:16)
- Logueado: avatar inicial email + estado sync + espacio activo + botón logout
- No logueado: lista de beneficios + botón Google login con SVG
- `handleLogout` usa `clearAuth()` (no `clearSessionAndSpace`)

### `src/components/layout/TopBar.tsx` *(reescrito)*
- Props: `onMenuToggle`, `onSettings`, `onAccount`, `onNewTask?`, `onSearch?`
- Botón cuenta: inicial en círculo accent + punto verde si logueado
- Botón 🔍 Search abre GlobalSearch (Cmd+K)
- `PAGE_TITLES` incluye `/stats`

### `src/components/layout/Layout.tsx`
- Estado `accountOpen` + componente `AccountPanel` + pasa `onAccount` a TopBar

### `src/components/settings/SettingsDrawer.tsx` *(expandido)*
- 3 pestañas: `appearance` | `notifications` | `data`
- Notifications: `Notification.requestPermission()`, estado, pasos de funcionamiento
- Data: export JSON, import JSON, zona de peligro (reset)

### `src/hooks/useReminders.ts` *(reescrito — anti-storm)*
- Polling 60s, `setTimeout` para cada reminder, `Notification` API
- Guard anti-duplicado: `task.notified[key]`
- `useRef` para `upsertTask` (evita que disparar notificación reinicie todos los timers)
- Skip si timer con mismo key ya existe; cancela timers solo de tareas eliminadas/completadas

### `src/App.tsx`
- `AppInner` (usa `useReminders`) + `App` (envuelve con `ToastProvider`)

### `src/components/tasks/TaskCard.tsx`
- En modo espacio muestra chip azul con icono `Users` para tareas de otros miembros
- `creatorLabel = task.createdBy?.includes('@') ? split('@')[0] : slice(0,8)`

### `src/views/Dashboard.tsx`
- Banner animado (`AnimatePresence`) cuando `meta.spaceId` está activo
- Cálculo `overdue` usa comparación de fecha-solamente (`startOfToday`) — tareas de hoy nunca son overdue

### `src/views/StatsView.tsx` *(nuevo)*
- Ruta `/stats` — KPIs ring, racha, mejor día, gráfico semanal, desglose por curso y prioridad
- Funciones de fecha en hora local (no UTC)

### `src/components/search/GlobalSearch.tsx` *(nuevo)*
- Command palette Cmd/Ctrl+K; busca tasks/courses/events; HighlightText; navegación teclado

### `src/hooks/useAudioRecorder.ts` *(nuevo)*
- Gestión del ciclo de vida MediaRecorder: idle/requesting/recording/stopped
- Auto-detección de codec: webm;codecs=opus → webm → ogg → mp4

### `src/components/tasks/AudioRecorder.tsx` *(nuevo)*
- UI completa: grabar, detener (auto-upload), reproducir, re-grabar, eliminar
- Solo llama `onChange(url)` si el upload fue exitoso

### `src/types/index.ts`
- `Task.audioUrl?: string | null`
- `SpaceHistoryEntry { code, name, joinedAt }`
- `Meta.spaceHistory: SpaceHistoryEntry[]`

### `storage.rules` *(nuevo)*
- `users/{uid}/audio/*` — máx 10MB, solo el propietario
- `spaces/{spaceId}/audio/*` — máx 10MB, cualquier usuario autenticado
- **Pegar en Firebase Console → Storage → Reglas y publicar**

### `src/styles/animations.css`
```css
@keyframes pulse-green {
  0%   { box-shadow: 0 0 0 0 var(--success-soft) }
  70%  { box-shadow: 0 0 0 8px transparent }
  100% { box-shadow: 0 0 0 0 transparent }
}
```

### `firestore.rules`
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuth()  { return request.auth != null; }
    function uid()     { return request.auth.uid; }
    function isMember(spaceId) {
      return isAuth() &&
        uid() in get(/databases/$(database)/documents/spaces/$(spaceId)/info/data).data.members;
    }
    match /users/{userId}/{col}/{doc} {
      allow read, write: if isAuth() && uid() == userId;
    }
    match /spaces/{spaceId}/info/data {
      allow read: if isAuth();
      allow create: if isAuth() && request.resource.data.owner == uid() && uid() in request.resource.data.members;
      allow update: if isAuth() && (
        resource.data.owner == uid()
        || (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['members']) && uid() in request.resource.data.members)
      );
    }
    match /spaces/{spaceId}/{col}/{docId} {
      allow read, write: if isMember(spaceId);
    }
  }
}
```
> **Las reglas deben pegarse manualmente en Firebase Console → Firestore → Reglas** (el CLI no puede autenticarse de forma no interactiva en este entorno).

### `firebase.json` / `.firebaserc` / `firestore.indexes.json`
- Configurados y listos para `firebase deploy --only firestore:rules` cuando se pueda autenticar

---

## Fases completadas ✅

1. Migración Vite + React + TypeScript
2. Zustand store completo (tasks, courses, tags, events, meta, settings)
3. Firebase Auth (Google Sign-In)
4. Firestore sync bidireccional (personal y espacios)
5. Espacios colaborativos — crear / unirse / salir / tiempo real
6. Reglas de seguridad Firestore
7. AccountPanel + TopBar refactorizado
8. SettingsDrawer expandido (appearance + notifications + data)
9. Hook `useReminders` con Notification API
10. Atribución de creador en TaskCard (modo espacio)
11. Banner de espacio activo en Dashboard
12. Fix bug Calendar tabs en móvil
13. **Notas de voz en tareas** — MediaRecorder + Firebase Storage + AudioRecorder UI
14. **Vista de estadísticas** — `/stats` con KPIs, gráfico semanal, desglose por curso/prioridad
15. **Búsqueda global** — command palette Cmd+K, busca tasks/courses/events con highlight

---

## Fases pendientes 🔲

### ✅ Notas de voz en tareas (COMPLETADA)
- `src/hooks/useAudioRecorder.ts` — hook MediaRecorder con estados: idle/requesting/recording/stopped
- `src/components/tasks/AudioRecorder.tsx` — UI: grabar, detener, escuchar, re-grabar, eliminar
- Auto-upload a Firebase Storage en cuanto para la grabación → URL guardada en `task.audioUrl`
- `task.audioUrl?: string | null` añadido a tipo `Task`
- `AudioRecorder` integrado en `TaskModal` (solo si `meta.uid`)
- Icono mic azul en `TaskCard` cuando la tarea tiene audio
- `storage.rules` — reglas para `users/{uid}/audio/*` y `spaces/{spaceId}/audio/*`
- `firebase.json` actualizado con `"storage": { "rules": "storage.rules" }`
- **Pegar `storage.rules` en Firebase Console → Storage → Reglas**

### ✅ Vista de estadísticas (COMPLETADA)
- `src/views/StatsView.tsx` — ruta `/stats`
- KPIs: tasa de completado (ring SVG), tareas pendientes, racha de días, mejor día
- Gráfico de barras CSS de actividad semanal (últimos 7 días)
- Desglose por curso con barra de progreso
- Distribución de prioridad de pendientes
- Sidebar + MobileNav actualizados (Stats reemplaza Tags en móvil)

### ✅ Búsqueda global (COMPLETADA)
- `src/components/search/GlobalSearch.tsx` — command-palette estilo
- Shortcut `Cmd/Ctrl+K` global desde cualquier pantalla
- Busca en tasks (título/descripción/instrucciones), courses (nombre/código/profesor), events
- Navegación teclado: ↑↓ para navegar, Enter para abrir, Esc para cerrar
- Highlight del texto coincidente
- Botón 🔍 en TopBar
- `onSearch` prop añadida a `TopBar` y `Layout`

### 🎓 Onboarding
- Flag `meta.onboarded` existe pero nunca se usa
- Flujo guiado: crear primer curso → primera tarea → explicar espacios → `setOnboarded(true)`
- Modal con pasos animados, solo aparece en primer uso

---

## Errores conocidos / resueltos (historial)

| Error | Causa | Fix |
|---|---|---|
| Preview servía `.tsx` raw | `launch.json` usaba `npx serve` | Cambiado a `npx vite --host` puerto 5174 |
| `upsertCourse/Tag/Event` sincronizan datos parciales | Solo se enviaba `{ ...course, id }` sin `createdAt/updatedAt` | Capturar objeto completo antes de sync |
| Calendar tab "Semana" activo incorrecto en móvil | `activeView` sobreescribe `calView` en móvil | Ocultar tab semana en móvil, usar `calView` para clase activa |
| Firestore "insufficient permissions" al unirse | No existía `firestore.rules` | Creadas reglas completas (pegar en consola manualmente) |
| Animación `pulse-ring` color incorrecto para indicador verde | Usaba `var(--accent-soft)` | Nuevo keyframe `pulse-green` con `var(--success-soft)` |
| Firebase CLI login falla en modo no interactivo | Requiere browser | Abrir URL de Firebase Console manualmente |
| **Logout borraba todos los datos y salía del espacio** | `initAuth` onLogout llamaba `clearSessionAndSpace()` | Cambiado a `clearAuth()` — solo limpia uid/email |
| **Salir de espacio actuaba como logout** | `handleLeave` llamaba `clearSession()` | Reescrito: solo limpia spaceId, re-subscribe a datos personales |
| **`useReminders` timer storm** | `upsertTask` en deps causaba re-schedule masivo al disparar notificación | `useRef` para `upsertTask`, skip si timer ya existe, solo cancela timers de tareas eliminadas/completadas |
| **`deleteCourse`/`deleteTag` no sync tareas afectadas** | Tareas con `courseId` borrado se actualizaban en Zustand pero no en Firestore | Capturar tareas afectadas antes del setState, `_sync('set', 'tasks', ...)` por cada una |
| **`AudioRecorder` guardaba `blob://` URL en Firestore al fallar upload** | `onChange(blobUrl)` llamado incluso en fallo | Solo `setCommittedUrl` local en fallo; `onChange` solo si upload exitoso |
| **Stale spaceId causa app vacía sin feedback** | `permission-denied` en snapshot solo mostraba console.warn | `fsSubscribe` acepta `onError`; `subscribeToData` detecta permission-denied y hace fallback a datos personales |
| **Dashboard double-count tareas de hoy en "Atrasadas"** | `parseDue()` devuelve datetime, tareas de hoy pasadas su hora contaban como overdue | Overdue usa comparación solo por fecha con `startOfToday` (medianoche) |
| **`StatsView` timezone UTC** | `new Date().toISOString()` devuelve UTC, usuarios en UTC+ veían datos del día incorrecto | `localDatestamp(d)` usa `d.getFullYear()/.getMonth()/.getDate()` (hora local) |
| **`GlobalSearch` Cmd+K no cierra si ya está abierto** | Handler solo llamaba `e.preventDefault()` | Cuando `open=true`, Cmd+K llama `onClose()` |

---

## Comandos útiles

```bash
# Desarrollo
npx vite --host --port 5174

# Build
npx vite build

# Deploy (requiere firebase login previo)
firebase deploy --only firestore:rules
firebase deploy --only hosting
```

---

*Generado automáticamente — última actualización: 2026-04-29 (post revisión masiva de bugs)*
