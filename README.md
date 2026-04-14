# 🏢 Sala de Juntas — Sistema de Reservaciones

Web app para gestión de reservaciones de sala de juntas con Firebase Firestore en tiempo real y hosting en GitHub Pages.

---

## 📁 Estructura del proyecto

```
sala-juntas/
├── index.html   ← App principal + Firebase SDK
├── style.css    ← Estilos completos
├── app.js       ← Lógica de la aplicación
└── README.md    ← Esta guía
```

---

## 🔥 Paso 1 — Crear proyecto en Firebase

1. Ve a **https://console.firebase.google.com/**
2. Haz clic en **"Agregar proyecto"**
3. Dale un nombre (ej. `sala-juntas-empresa`)
4. Desactiva Google Analytics si no lo necesitas → **Crear proyecto**
5. Una vez creado, haz clic en el ícono **`</>`** (Web) para agregar una app web
6. Ponle un nombre (ej. `sala-juntas-web`) y haz clic en **"Registrar app"**
7. Copia el objeto `firebaseConfig` que aparece. Luce así:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "sala-juntas-xxx.firebaseapp.com",
  projectId: "sala-juntas-xxx",
  storageBucket: "sala-juntas-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

8. En el panel de Firebase, ve a **Build → Firestore Database**
9. Haz clic en **"Crear base de datos"**
10. Elige **"Comenzar en modo de prueba"** (puedes asegurar después)
11. Selecciona la región más cercana (ej. `us-central1` o `nam5`) → **Habilitar**

---

## ⚙️ Paso 2 — Configurar las credenciales en index.html

Abre `index.html` y busca esta sección cerca del final del archivo:

```js
// 🔥 FIREBASE CONFIG — reemplaza con tu proyecto
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROJECT.firebaseapp.com",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_PROJECT.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};
```

**Reemplaza todos los valores** con los de tu proyecto de Firebase.

---

## 🔐 Paso 3 — Cambiar el código maestro (opcional)

En `app.js`, en la primera línea, cambia:

```js
const MASTER_CODE = 'ADMIN2024';
```

Por el código que quieras usar. **Guárdalo en un lugar seguro.**

---

## 🐙 Paso 4 — Subir a GitHub

### Si ya tienes Git instalado:

```bash
# Dentro de la carpeta sala-juntas/
git init
git add .
git commit -m "primera versión sala de juntas"

# Crea un repo NUEVO en github.com (sin README), luego:
git remote add origin https://github.com/TU_USUARIO/sala-juntas.git
git branch -M main
git push -u origin main
```

### Si no tienes Git:

1. Ve a **https://github.com/new**
2. Crea un repositorio nuevo (público), sin inicializarlo
3. Haz clic en **"uploading an existing file"**
4. Arrastra los 3 archivos (`index.html`, `style.css`, `app.js`)
5. Haz clic en **"Commit changes"**

---

## 🌐 Paso 5 — Activar GitHub Pages

1. En tu repositorio de GitHub, ve a **Settings → Pages**
2. En **"Source"**, selecciona **"Deploy from a branch"**
3. En **"Branch"**, selecciona `main` y carpeta `/ (root)`
4. Haz clic en **Save**
5. En ~2 minutos tu app estará disponible en:

```
https://TU_USUARIO.github.io/sala-juntas/
```

---

## 🔒 Paso 6 — Asegurar Firestore (recomendado)

Una vez en producción, ve a **Firebase → Firestore → Reglas** y reemplaza:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /reservaciones/{id} {
      // Cualquiera puede leer
      allow read: if true;
      // Solo escritura desde la web (sin auth requerida por ahora)
      allow write: if true;
    }
  }
}
```

Para mayor seguridad en el futuro puedes agregar Firebase Authentication.

---

## ✅ Funcionalidades incluidas

| Característica | Detalle |
|---|---|
| 📝 Formulario | Nombre, depto, fecha, horario, asistentes, correo, propósito |
| 🚫 Bloqueo de horarios | Los slots ocupados aparecen deshabilitados automáticamente |
| ⚡ Tiempo real | Cualquier cambio se refleja al instante sin recargar |
| 📅 Calendario | Vista mensual con días libres, parciales y ocupados |
| 🔍 Detalle por día | Clic en día ocupado muestra quién y a qué hora |
| 🔐 Código maestro | Solo con el código se pueden eliminar reservaciones |
| 🌐 Compartible | Cualquiera con el link puede consultar y reservar |
| 📱 Responsive | Funciona en móvil, tablet y escritorio |

---

## 🛠 Preguntas frecuentes

**¿Cómo cambio el nombre de la sala?**
Edita el `<title>` y el `<h1>` en `index.html`.

**¿Puedo agregar más horarios?**
Sí, agrega más `<option>` en el `<select id="f-horario">` de `index.html` y actualiza `TOTAL_SLOTS` en `app.js`.

**¿Cómo actualizo el código desplegado?**
Edita los archivos y haz `git push` — GitHub Pages se actualiza automáticamente en ~1 minuto.

**¿El link es permanente?**
Sí, `https://TU_USUARIO.github.io/sala-juntas/` es permanente mientras el repo exista.
