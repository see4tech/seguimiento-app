# Sistema de Seguimiento — Setup completo

Stack: **React + Vite** → **Netlify** | **Express serverless** → **Netlify Functions** | **PostgreSQL + Storage** → **Supabase**

---

## 1. Supabase — crear el proyecto y la base de datos

1. Entra a https://supabase.com → New project
2. Anota tu **Project URL** y las dos keys:
   - `anon` (public) → va en el frontend
   - `service_role` (secret) → va en las funciones serverless
3. Ve a **SQL Editor** → New query → pega el contenido de `supabase/schema.sql` → Run
4. Ve a **Storage** → New bucket:
   - Nombre: `voice-updates`
   - Tipo: **Public** ✓ (para reproducir audios sin autenticación)

---

## 2. GitHub — crear el repositorio

```bash
cd seguimiento-app
git init
git add .
git commit -m "Initial commit"
```

En GitHub, crea un repositorio nuevo (sin README) y sigue las instrucciones para subir:
```bash
git remote add origin https://github.com/TU_USUARIO/seguimiento-app.git
git push -u origin main
```

---

## 3. Netlify — conectar el repositorio y configurar variables

1. Entra a https://netlify.com → Add new site → Import from Git → elige tu repo
2. Netlify detecta el `netlify.toml` automáticamente:
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
3. Ve a **Site configuration → Environment variables** y agrega:

| Variable | Valor | Descripción |
|---|---|---|
| `SUPABASE_URL` | `https://xxx.supabase.co` | Project URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Service role key (secreta) |
| `JWT_SECRET` | string aleatorio largo | Para firmar tokens de sesión |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Misma URL, para el frontend |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Anon key de Supabase |

4. **Deploy** → Netlify construye y despliega. Toma ~1 minuto.

---

## 4. Crear el usuario administrador

Una vez desplegado, tienes dos opciones:

**Opción A (recomendada) — desde tu terminal local:**
```bash
# Primero crea un .env en la raíz con tus valores reales:
cp .env.example .env
# edita .env con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY

npm install
node netlify/functions/setup.js
```

**Opción B — desde Supabase SQL Editor:**
```sql
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Tu Nombre',
  'tu@email.com',
  '$2a$10$...', -- genera el hash con: node -e "console.log(require('bcryptjs').hashSync('tu-contraseña', 10))"
  'admin'
);
```

---

## 5. Dar acceso a los gerentes

En el dashboard de la app (como admin):
1. Menú de usuario (esquina superior derecha) → **Gestionar usuarios**
2. Agregar usuario → nombre, email, contraseña, rol: Gerente
3. Comparte la URL del sitio + sus credenciales con cada gerente

---

## Desarrollo local

Para correr todo localmente necesitas **Netlify CLI**:

```bash
npm install -g netlify-cli

# Crea los archivos .env:
cp .env.example .env             # variables del backend
cp frontend/.env.example frontend/.env.local  # variables del frontend
# Edita ambos con tus valores reales de Supabase

# Instala dependencias:
npm install
cd frontend && npm install && cd ..

# Corre con netlify dev (lanza frontend + functions juntos):
netlify dev
```

Abre: http://localhost:8888

---

## Flujo semanal

| Día | Quién | Acción |
|-----|-------|--------|
| **Lunes** | Charles | Abre dashboard → vista "Semanal" para revisar la semana anterior. Crea tareas nuevas si hay compromisos nuevos de reuniones |
| **En cualquier momento** | Charles | Sube al sistema notas de reuniones para extraer compromisos |
| **Viernes** | Gerentes | Entran a su portal → "Reportar avance" en cada tarea activa (texto o nota de voz grabada) |
| **Viernes/Lunes** | Charles | Vista "Semanal" → ve quién reportó, qué dijo, qué está en riesgo |

---

## Estructura del proyecto

```
seguimiento-app/
├── netlify.toml                    ← configuración de build y redirects
├── package.json                    ← dependencias de las functions
├── netlify/
│   └── functions/
│       ├── api.js                  ← Express + serverless-http (entry point)
│       ├── db.js                   ← Supabase client (singleton)
│       ├── setup.js                ← crear admin inicial
│       ├── middleware/auth.js      ← validación JWT
│       └── routes/
│           ├── auth.js             ← login, usuarios
│           ├── tasks.js            ← CRUD de tareas
│           └── updates.js          ← actualizaciones semanales
├── frontend/
│   └── src/
│       ├── supabaseClient.js       ← cliente Supabase + helper de Storage
│       ├── api.js                  ← cliente HTTP para las functions
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx       ← admin: tablero, lista, vista semanal
│       │   ├── ManagerPortal.jsx   ← gerentes: mis tareas + reportar
│       │   └── TaskDetail.jsx      ← detalle + historial de updates
│       └── components/
│           ├── VoiceRecorder.jsx   ← grabación de voz en el browser
│           ├── StatusBadge.jsx
│           ├── NewTaskModal.jsx
│           └── UserManagement.jsx
└── supabase/
    └── schema.sql                  ← SQL para ejecutar en Supabase
```
