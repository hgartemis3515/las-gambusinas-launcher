# Launcher — Instrucciones de inicio y lanzamiento

## Requisitos previos

- **Node.js** 18+ instalado y accesible en PATH.
- **npm** incluido con Node.
- **Git** instalado y accesible en PATH (para clonación y actualizaciones).
- **MongoDB** corriendo localmente (el backend lo necesita).
- Para builds APK: **cuenta EAS** configurada (`eas login` ejecutado previamente).

---

## Inicio rápido

### 1. Instalar dependencias

```bash
cd launcher
npm install
```

### 2. Ejecutar en modo desarrollo

```bash
npm start
```

Esto abre la ventana de Electron. Verás:

1. **Splash screen** animada con anillo de progreso (~1.5 s).
2. **Transición** al dashboard principal con animación de entrada.
3. Si es la primera vez, aparece el **asistente de configuración**.

### 3. Primera configuración (asistente)

1. Ve a **Rutas e instalación** → clic en **Detectar y guardar rutas**.
2. Si faltan repos, usa **Clonar los 3 que falten**.
3. Verifica los puertos en **Avanzado** si no usas los por defecto (backend 3000, cocina 3001, Metro 8081).
4. Guarda la configuración con el botón **Guardar** en la barra superior.

### 4. Iniciar los servicios

Tienes dos formas:

| Forma | Descripción |
|-------|-------------|
| **Botón "Iniciar todo"** | Arranca backend, cocina y (opcionalmente) Expo en secuencia con delays configurables. Desmarca "Incluir Mozos" si solo necesitas backend + cocina. |
| **Individual** | En la sección **Servicios**, usa los botones "Iniciar" de cada tarjeta. |

### 5. Detener servicios

- **"Detener todo"** — detiene los 3 servicios en secuencia.
- **Individual** — botón "Detener" en cada tarjeta de servicio.
- Al cerrar el launcher (si está activado "Detener servicios al cerrar" en Avanzado), se detienen automáticamente.

---

## Inicio automático

En **Avanzado**, configura:

| Opción | Efecto |
|--------|--------|
| **Launcher con Windows** | Crea un acceso directo en la carpeta Inicio de Windows. |
| **Al abrir: iniciar backend y cocina** | Al abrir el launcher, inicia backend y cocina automáticamente. |
| **También iniciar Expo** | Incluye Metro/Expo en el auto-inicio. |
| **Comprobar MongoDB** | Verifica que Mongo esté disponible antes de arrancar el backend. |
| **Forzar backend si Mongo falla** | Inicia el backend aunque MongoDB no responda. |

Los delays de auto-inicio son configurables:
- **Retraso auto-inicio (ms)**: espera antes del primer servicio (por defecto 3000 ms).
- **Entre servicios (ms)**: espera entre un servicio y el siguiente (por defecto 2000 ms).

---

## Build para distribución

### Paquete local (sin instalador)

```bash
npm run pack
```

Salida en `dist/` — útil para pruebas.

### Instalador NSIS + portable

```bash
npm run dist
```

Genera en `dist/`:
- Instalador `.exe` (NSIS)
- Versión portable `.exe`

> El script `predist` mata procesos que bloquean archivos antes de empaquetar.

---

## Estructura de la interfaz

```
┌──────────────────────────────────────────────────────┐
│  Splash screen animada (1.5s)                       │
│  → Anillo SVG + barra de progreso + texto de estado │
└──────────────────────────────────────────────────────┘
                       ↓ fade
┌──────────┬───────────────────────────────────────────┐
│ Sidebar  │  Topbar: [Título]          [Actualizar] │
│          │                               [Guardar]  │
│ Resumen  ├───────────────────────────────────────────┤
│ Servicios│                                           │
│ Rutas    │  ┌─ Chips: [●Backend Activo] [●Cocina] ─┐│
│ Git      │  └─ Estado global en tiempo real ────────┘│
│ Datos    │                                           │
│ Mozos    │  ┌──────────────────────────────────────┐  │
│ Avanzado │  │  ⚡ Iniciar todo    ■ Detener todo  │  │
│ Registro │  │  ☑ Incluir App Mozos (Expo)         │  │
│          │  │  ▓▓▓▓▓▓▓▓▓░░░░░░ 45%  ← barra prog │  │
│          │  │  ● Backend: Activo ✓                  │  │
│          │  │  ● Cocina: Iniciando…                 │  │
│          │  │  ○ Mozos: Esperando…                  │  │
│          │  └──────────────────────────────────────┘  │
│          │  [MongoDB] [Backend] [Cocina] [Expo]       │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

---

## Atajos y tips

- **"Iniciar todo"**: arranca backend, cocina y (opcionalmente) Expo en secuencia. Muestra barra de progreso animada con pasos individuales por servicio, actualizando estado en tiempo real (esperando → iniciando → activo / error).
- **"Detener todo"**: detiene los 3 servicios en secuencia.
- **Barra global de estado**: chips en la sección Resumen que muestran Backend/Cocina/Mozos con indicador animado (activo/iniciando/detenido).
- **Actualización manual**: botón "Actualizar" en la topbar refresca MongoDB, HTTP, servicios y Git.
- **Logs en tiempo real**: sección "Registro" muestra la salida de todos los procesos.
- **Git**: "Comprobar actualizaciones" hace `fetch` + compara ramas. Luego puedes `pull`.
- **APK de Mozos**: sección "Mozos (APK)" → botones EAS preview/production. Requiere `eas login` previo.
- **Datos JSON**: sección "Datos" lista los `.json` en `data/` del backend y permite eliminar solo el manifiesto.

---

## Resolución de problemas

| Problema | Solución |
|----------|----------|
| No detecta las carpetas de los repos | Configura las rutas manualmente en "Rutas e instalación" o usa "Clonar los 3". |
| Backend no arranca | Verifica que MongoDB esté corriendo y que el puerto no esté ocupado. Revisa "Registro". |
| El launcher no abre | Ejecuta `npm start` desde la carpeta `launcher/` y revisa la consola de Node. |
| Error al empaquetar | Cierra otras instancias de Electron y ejecuta `npm run dist` nuevamente. |
| EAS build falla | Verifica `eas login` y que el proyecto Expo esté configurado con `eas.json`. |

---

*Creado como complemento de `PROYECTO.md` y `COMPARATIVA-LAUNCHER.md`.*