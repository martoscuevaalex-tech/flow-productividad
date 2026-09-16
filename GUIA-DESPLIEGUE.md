# Publica FLOW con GitHub + Vercel y activa la sincronización

No hace falta convertirla en una app de App Store o Play Store. Una sola dirección HTTPS permite abrir e instalar FLOW en computadora, celular y tablet.

## Si ya tienes FLOW 1 publicada

Ejecuta primero `supabase/migrations/002_daily_routines.sql` en tu proyecto de Supabase y después despliega este código actualizado. La migración añade repetición diaria sin borrar el historial. No necesitas crear otro proyecto de Supabase ni otro repositorio.

## Configuración actual de Alex

El proyecto FLOW ya está creado y su esquema está instalado. Esta entrega lo conecta mediante `src/public-config.ts`; no necesitas ejecutar otra instalación ni copiar claves para usar este proyecto. Los pasos siguientes sirven para otro proyecto o para configurar el acceso automático por correo. Mientras se configura la redirección, usa en Ajustes **Entrar pegando el enlace del correo**.

## 1. Crea la base de datos

1. Entra a [Supabase](https://supabase.com/dashboard) con tu cuenta y crea un proyecto dedicado a FLOW.
2. Espera a que esté listo y abre **SQL Editor → New query**.
3. Copia todo el contenido de `supabase/schema.sql` y ejecútalo. Es la instalación inicial; no elimina otras tablas del proyecto.
4. En **Project Settings → API** o **Connect**, copia la URL del proyecto y su clave **publishable** o **anon pública**. La ubicación exacta puede variar según el panel.
5. Guarda estos dos datos para añadirlos en Vercel. No uses `service_role` ni una clave secreta.

Supabase aporta el acceso por correo y la base de datos que compartirán tus dispositivos. La implementación sigue [el acceso por enlace de Supabase](https://supabase.com/docs/reference/javascript/auth-signinwithotp) y [las suscripciones a cambios](https://supabase.com/docs/reference/javascript/subscribe).

## 2. Sube el proyecto a GitHub

1. Entra a [GitHub](https://github.com/new).
2. Crea un repositorio llamado `flow-productividad`, preferiblemente **Private**. Puedes dejar sin marcar README, licencia y gitignore porque el proyecto ya los incluye.
3. Sube los archivos **que están dentro de la carpeta `flow`**, directamente a la raíz del repositorio. No subas el ZIP como un solo archivo.
4. Comprueba que en la raíz aparecen `package.json`, `package-lock.json`, `index.html`, `vercel.json`, `src`, `public`, `scripts` y `supabase`.
5. Incluye `.gitignore` y `.env.example` si la subida por el navegador no muestra archivos que comienzan por punto. No subas `.env.local` con claves.

Si prefieres la terminal, estando dentro de la carpeta del proyecto:

```bash
git init -b main
git add .
git commit -m "Crear FLOW: tareas, dashboard, calendario y PWA"
git remote add origin https://github.com/TU-USUARIO/flow-productividad.git
git push -u origin main
```

Sustituye `TU-USUARIO` por tu usuario real de GitHub. GitHub puede pedirte iniciar sesión para subir el repositorio.

## 3. Importa el repositorio en Vercel

1. Abre [New Project de Vercel](https://vercel.com/new), conecta GitHub e importa `flow-productividad`.
2. Usa la raíz del repositorio como **Root Directory**. Si subiste una carpeta contenedora llamada `flow`, selecciona esa carpeta.
3. Framework: **Vite**. Build Command: `npm run build`. Output Directory: `dist`.
4. En Environment Variables añade:

| Nombre | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL de tu proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave publishable o anon pública de Supabase |

5. Elige **Deploy** y espera a que esté listo. Conserva la dirección estable de producción, por ejemplo `https://flow-productividad.vercel.app` si Vercel te asigna ese nombre.

Las variables que comienzan por `VITE_` forman parte del frontend; por eso aquí solo se usan la URL y la clave publicable. Si añades o cambias variables después de publicar, vuelve a desplegar para que se incorporen al build.

## 4. Permite el acceso por correo

1. En Supabase abre **Authentication → URL Configuration**.
2. En **Site URL**, introduce la dirección HTTPS estable de FLOW en Vercel.
3. En **Redirect URLs**, añade esa misma dirección de producción. Si trabajas en tu computadora, puedes añadir también `http://localhost:5173`.
4. En **Authentication → Providers**, confirma que Email está habilitado y permite crear la cuenta con el primer enlace de acceso.
5. En la plantilla de correo de acceso, conserva el enlace de confirmación que incluye `{{ .ConfirmationURL }}`. No cambies la plantilla por una que solo envía un código, porque esta interfaz usa un enlace.

Los despliegues preview tienen direcciones distintas. Usa la URL estable para acceder desde tus dispositivos; si necesitas probar acceso en una preview, autoriza expresamente su URL en Supabase.

## 5. Entra y comprueba la sincronización

1. Abre FLOW en tu computadora, entra a **Ajustes**, escribe tu correo y pulsa **Enviarme enlace de acceso**.
2. Abre el correo y el enlace en el navegador donde quieres usar FLOW. Revisa Spam si no llega.
3. Si tenías tareas locales antes de iniciar sesión, pulsa **Añadir mis tareas locales**.
4. Crea una tarea para hoy. Espera a que el estado indique **Sincronizado**.
5. Abre la misma dirección en tu celular o tablet y entra con **el mismo correo**.
6. Comprueba que aparece la tarea. Márcala en el celular y verifica que el dashboard y el calendario de ambos dispositivos cambian.
7. Desmárcala, cambia su fecha y elimínala para comprobar que las tres vistas siguen coincidiendo.
8. Con la app ya abierta y cargada, desconecta un dispositivo, crea o edita una tarea y vuelve a conectar. Debe pasar de cambios pendientes a Sincronizado.
9. Para comprobar conflictos: con dos dispositivos sin conexión, cambia la misma tarea en ambos. Conéctalos de uno en uno. El segundo debe pedir elegir la versión, sin borrar su cambio local automáticamente.

## 6. Instala la PWA

- **iPhone o iPad:** abre la URL en Safari → Compartir → Añadir a pantalla de inicio.
- **Android:** abre en Chrome → menú → Instalar app o Añadir a pantalla de inicio.
- **Mac o Windows:** abre en un navegador compatible y usa la opción de instalación. En FLOW, Ajustes muestra un botón cuando el navegador lo ofrece.

La primera apertura requiere conexión para cargar los archivos e instalar la precarga. Después, puedes abrir la app sin conexión y trabajar con las tareas ya guardadas en ese dispositivo. Iniciar sesión por primera vez necesita internet. El envío de pendientes ocurre mientras FLOW está abierta, no se garantiza en segundo plano.

## Si algo falla

| Situación | Qué revisar |
| --- | --- |
| Ajustes muestra “Sincronización por activar” | Faltan las dos variables o no se volvió a desplegar después de añadirlas. |
| El correo no llega | Spam, proveedor Email habilitado, límites de envío y configuración de correo en Supabase. |
| El enlace abre otra dirección | Site URL y Redirect URLs deben coincidir con la URL de producción. |
| No se guardan tareas en la nube | Ejecuta el esquema completo y revisa el error en Ajustes. No desactives RLS. |
| En el otro dispositivo no aparecen | Usa la misma URL y el mismo correo; confirma Sincronizado en el primero. |
| Sigue mostrando cambios pendientes | Mantén FLOW abierta y recupera la conexión. Si hay un conflicto, resuélvelo en Ajustes. |
| No aparece botón de instalar | Usa HTTPS y un navegador compatible; en iOS la instalación se hace desde Compartir. |

El repositorio contiene una instalación inicial reproducible. Para cambios posteriores de la base de datos, crea migraciones incrementales en lugar de editar tablas existentes sin registrar el cambio.

Referencia de publicación: [despliegue de una app Vite](https://vite.dev/guide/static-deploy).
