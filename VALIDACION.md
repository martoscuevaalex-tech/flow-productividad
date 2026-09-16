# Validación de FLOW

Comprobaciones realizadas sobre esta entrega:

- **Build de producción:** TypeScript y Vite finalizados correctamente. El build genera el shell de la PWA con 9 recursos locales.
- **Lógica:** 18 pruebas automáticas aprobadas. Las tres pruebas de acceso validan la aceptación de un enlace propio, rechazo de otros proyectos o direcciones engañosas, y denegación de otras acciones de autenticación. Incluyen completar/desmarcar, mover una tarea de fecha, eliminarla, porcentaje por periodo, semanas que empiezan en lunes, febrero bisiesto, rachas entre meses/años, días vacíos, días futuros y proyección de cambios pendientes. Las nuevas pruebas comprueban el reinicio diario sin borrar el día anterior, identidades iguales entre dispositivos, recuperación de días omitidos, fin de una rutina, ausencia de resurrecciones, herencia de ediciones y migración local desde FLOW 1.
- **Permisos y escrituras:** `supabase/tests/flow_security.sql` ejecutado con PostgreSQL local en WASM (PGlite) y un esquema de autenticación simulado. Comprobadas lectura del propietario, aislamiento entre cuentas, denegación de escrituras directas, denegación de lectura y RPC anónimas, idempotencia, conflictos por versión y prevención de resurrección de tareas eliminadas. Solo se excluyó la declaración de la publicación Realtime del proveedor, que requiere el servicio alojado.
- **Interacciones:** el bundle real de producción se ejecutó en una simulación de DOM. Se comprobó el render de la app, creación y edición, marcado de una tarea, reacción del dashboard, persistencia local, cambio de tema y eliminación con confirmación. En FLOW 2 se simuló además el cambio de fecha a medianoche de Perú: el día nuevo apareció sin marcar, el día anterior conservó su cumplimiento, y detener la rutina preservó el historial y evitó nuevas copias.

La migración desde el esquema real de FLOW 1 también se ejecutó sobre PostgreSQL local: conservó el cumplimiento y la revisión original, y permitió crear el día siguiente sin marcar.

Pendiente de comprobar en dispositivos reales:

- Acceso real por correo y sincronización entre dispositivos contra tu Supabase.
- Suscripción Realtime, cola con conexión intermitente y conflictos en dispositivos reales.
- Instalación y apertura sin conexión de la PWA en Safari/Chrome.
- Revisión visual en navegador a los anchos definidos en CSS. El navegador del entorno no pudo iniciarse; las interacciones en DOM no sustituyen una revisión visual.
- WebMCP en un navegador que soporte la API experimental.

La base de datos real de Supabase está instalada y verificada. La captura del panel Vercel confirmó el despliegue Listo. El acceso real por correo y la sincronización en dos dispositivos siguen sin verificarse desde este entorno. La guía de despliegue incluye pasos concretos para completar esas comprobaciones.

## Verificación del servicio Supabase de Alex

El proyecto FLOW (`ldylxkaoxftboijsiuwz`) recibió la migración `flow_initial_daily_routines`. Se ejecutó `supabase/tests/flow_security.sql` contra el servicio alojado y pasó; la transacción de pruebas se revirtió y no dejó tareas, operaciones ni cuentas de prueba. Una consulta posterior confirmó tablas vacías, RLS activo y pertenencia de `flow_tasks` a la publicación `supabase_realtime`. La entrega usa exclusivamente la clave publicable.

El asesor señala dos patrones intencionales: el historial interno no tiene políticas de lectura porque ningún cliente debe consultarlo ([RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)), y el RPC de escritura usa privilegios del servidor para mantener atómicamente tareas y operaciones ([función con privilegios](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)). El RPC deniega usuarios sin sesión, comprueba el propietario, limita los campos y exige revisión coincidente; las pruebas confirmaron aislamiento entre cuentas y denegación de escrituras directas.

La interfaz de acceso se probó con solicitudes simuladas: rechaza enlaces ajenos sin enviarlos, limpia el token del formulario, lo envía únicamente al proyecto FLOW y muestra el error de un token caducado. Esa simulación no crea una sesión real ni envía correo.
