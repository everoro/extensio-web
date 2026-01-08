# 🌸 Minuts al jardí – Extensión Firefox

**Minuts al jardí** es una extensión para el navegador **Firefox** que combina un **temporizador Pomodoro** con una **visualización artística del paso del tiempo**.  
Cada sesión se representa mediante una flor animada que crece progresivamente, transformando el tiempo de estudio en una experiencia visual y orgánica.

Proyecto académico desarrollado como adaptación del ejercicio *Rellotge Creatiu* al formato de **Web Extension (Manifest V3)**.

---

## ✨ Funcionalidades principales

- ⏱️ **Temporizador Pomodoro**
  - Iniciar, pausar y reiniciar el contador
  - Alternancia automática entre trabajo y descanso
  - Notificación y sonido al finalizar cada fase

- ⚙️ **Modos configurables**
  - Pomodoro 25 / 5
  - Pomodoro 15 / 3
  - Pomodoro 5 / 1
  - Modo personalizado (minutos de trabajo y descanso definidos por el usuario)

- 💾 **Persistencia del estado**
  - El temporizador mantiene su estado aunque se cierre el popup
  - Se guarda: fase actual, tiempo restante, modo, música y notificaciones

- 🎨 **Visualización animada**
  - Cada minuto genera un nuevo pétalo
  - El pétalo activo crece según los segundos
  - Emisión de polen animado para indicar el paso del tiempo
  - Fondo circular dinámico que se consume con el progreso

---

## 🛠️ Tecnologías utilizadas

- **HTML5** – Estructura de la interfaz
- **CSS3** – Estilos visuales
- **JavaScript (ES6)** – Lógica del temporizador
- **p5.js** – Animación y canvas
- **p5.js DOM** – Menús y elementos interactivos
- **WebExtensions API (Firefox – Manifest V3)**

---

## 🧩 Estructura del proyecto

extension-web/
│
├── manifest.json # Configuración de la extensión
├── popup.html # Interfaz del popup
├── style.css # Estilos
├── popup.js # Lógica del temporizador
├── sketch.js # Animación con p5.js
├── assets/ # Imágenes y sonidos
└── libs/ # Librerías externas (p5.js)

---

## 🔊 Sonido y notificaciones

- Música ambiental opcional en bucle
- Sonido corto al finalizar cada fase
- Notificaciones nativas del navegador (configurables)

> Para cumplir con las políticas CSP de Firefox (Manifest V3), se utiliza  
`HTMLAudioElement` en lugar de `p5.sound`.

---

## 🚀 Instalación (modo desarrollador)

1. Clona o descarga este repositorio
2. Abre Firefox y accede a: `about:debugging`
3. Selecciona **“Este Firefox”**
4. Haz clic en **“Cargar complemento temporal”**
5. Selecciona el archivo `manifest.json`

---

## 📚 Aprendizajes clave

- Estructuración de extensiones con **Manifest V3**
- Integración de **p5.js** dentro de un popup
- Persistencia de datos con `storeItem()` y `getItem()`
- Sincronización entre lógica de temporizador y animación
- Gestión de audio y notificaciones en extensiones Firefox

---

## 🔮 Posibles mejoras futuras

- Historial de sesiones
- Gráficas de tiempo de estudio y descanso
- Registro de minutos acumulados
- Uso de `browser.storage.sync` o `IndexedDB`
- Página de opciones con estadísticas (Chart.js)

---

## 👩‍💻 Autora

**Evelyn Rosado Romero**  
Proyecto académico – 2025
