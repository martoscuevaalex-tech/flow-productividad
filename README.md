# FLOW · Tu espacio para avanzar

FLOW 2: espacio negro con acentos violeta y azul y rutinas diarias. App personal de productividad para Alex. React + TypeScript + Vite, preparada para GitHub y Vercel, con Supabase para acceso y datos compartidos.

## Qué incluye

- Dashboard con tareas cumplidas, pendientes, porcentaje y racha actual. Periodos: día, semana (lunes a domingo) y mes.
- Gráfica de actividad semanal/mensual y resumen del día.
- Las tareas nuevas se repiten diariamente por defecto; puedes desactivar la repetición al crearlas. Cada fecha conserva un registro independiente.
- Tareas con título editable, fecha, lista personalizada, prioridad y notas. Marcar, desmarcar y eliminar actualiza todas las vistas.
- Calendario mensual con selección de día, sus tareas, días completos, racha actual y mejor racha.
- Diseño responsive para computadora, celular y tablet; modos claro y oscuro.
- PWA con manifest, iconos PNG, icono de iOS y service worker generado durante el build. Después de la primera carga completa puede abrirse sin conexión.
- Modo local utilizable sin configurar servicios. **En este modo los datos solo viven en el navegador actual.**
- Integración de acceso por enlace al correo, sincronización Realtime y refresco cada 15 segundos mientras la app está abierta.
- Cola de cambios sin conexión, guardada por usuario, reintentos idempotentes y conflictos de edición explícitos. No reemplaza toda la cuenta con una copia antigua de otro dispositivo.

## Empieza aquí

1. Descomprime este proyecto.
2. Para publicarlo: sigue [GUIA-DESPLIEGUE.md](GUIA-DESPLIEGUE.md).
3. Para trabajar en tu computadora: instala Node.js 22.12 o posterior, abre una terminal en esta carpeta y ejecuta:

```bash
npm ci
npm run dev
```

Esta entrega incluye la URL y la clave publicable del proyecto **FLOW de Alex** en `src/public-config.ts`. La base de datos ya está instalada. Puedes reemplazarlas con las variables de `.env.example` para usar otro proyecto. Hasta iniciar sesión, las tareas se guardan en el navegador actual; después de entrar con el mismo correo, usan la cuenta compartida de Supabase.

## Repetición diaria

Al cambiar el día en Perú, o al volver a abrir FLOW, cada rutina activa crea su tarea del día **sin marcar**. Los días anteriores mantienen sus estados. Los días en que no abriste FLOW se recuperan como pendientes; no se consideran cumplidos automáticamente. Dos dispositivos generan la misma identidad para la misma rutina y fecha, evitando duplicados.

Al editar una rutina se modifica el registro de esa fecha. Los días nuevos heredan el título, lista, prioridad y notas del registro más reciente. Las fechas de las rutinas no se mueven para conservar la continuidad; las tareas de un solo día sí pueden cambiar de fecha. **Dejar de repetir** detiene la rutina desde hoy y conserva los registros anteriores.

Las tareas locales de la primera versión se convierten en rutinas sin modificar sus estados originales. Si ya tienes la base de datos de FLOW 1, ejecuta `supabase/migrations/002_daily_routines.sql` antes de actualizar el frontend. Para una instalación nueva usa `supabase/schema.sql`.

## Reglas de progreso

- Las métricas se calculan con la **fecha asignada** a la tarea, no con la hora de pulsar el checkbox. Las tareas futuras de una semana o mes también forman parte de ese periodo.
- Un día está completo cuando tiene al menos una tarea y todas están marcadas. Puedes completar días anteriores; las métricas se recalculan.
- La racha suma días completos consecutivos, incluyendo hoy si está completo. Si hoy todavía no está completo, conserva la racha hasta ayer. Un día sin tareas o incompleto rompe la continuidad.
- Los días futuros no suman racha aunque marques sus tareas antes.
- El día actual sigue **America/Lima** en todos los dispositivos, para que el dashboard no cambie de fecha al usar una zona horaria distinta. La fecha de las tareas se guarda como calendario, sin desplazamiento horario.
- El modo claro/oscuro es una preferencia del dispositivo. Las tareas son los datos compartidos de tu cuenta.

## Acceso y sincronización

En Ajustes, entra con el mismo correo en todos tus dispositivos. Puedes abrir el enlace del correo o usar **Entrar pegando el enlace del correo**: copia el enlace del botón del correo y pégalo dentro de FLOW. Esta opción verifica el token directamente contra el proyecto de FLOW y sirve incluso cuando el correo abre otro navegador o su redirección todavía no está configurada. El enlace es privado, de un solo uso, y se limpia del formulario antes de verificarlo. Si ya tienes tareas del modo local, entra a tu cuenta y pulsa **Añadir mis tareas locales** en cada navegador que contenga tareas por trasladar. La importación es explícita; no mezcla silenciosamente datos locales con otras cuentas. Los mismos IDs no se importan dos veces.

Los cambios se muestran de inmediato y permanecen en una cola local hasta que la nube los confirme. Cada operación tiene un identificador único: reenviar una operación no duplica la tarea. Si dos dispositivos editan la misma versión de una tarea, el servidor rechaza la segunda edición sin sobrescribirla. FLOW ofrece **Usar versión de la nube** o **Aplicar mis cambios**. Una tarea eliminada en la nube no puede resucitar por un cambio antiguo.

La aplicación debe estar abierta para enviar pendientes. El navegador no garantiza ejecución en segundo plano. Una primera sesión y el acceso por correo requieren conexión. Borrar datos del navegador elimina tareas locales y cambios aún no enviados. Las tareas confirmadas en tu cuenta se pueden recuperar desde la nube.

## Seguridad del backend

`supabase/schema.sql` crea tablas privadas por cuenta con Row Level Security. Los clientes autenticados solo tienen lectura sobre sus propias tareas; las escrituras pasan por `flow_mutate`, que comprueba `auth.uid()`, propietario, tipos y versión, y registra cada operación dentro de una transacción. Los usuarios sin sesión no pueden leer ni escribir tareas. La función usa un `search_path` vacío y nombres de tablas cualificados. El historial de operaciones y las tareas eliminadas se conservan para garantizar reintentos y evitar resurrecciones.

Usa la clave **publicable/anon** del proyecto en el frontend. **Nunca** una `service_role` o una clave secreta. Los permisos dependen de RLS y de la sesión de usuario, no de ocultar la clave publicable. Referencia: [seguridad por filas de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Comandos

```bash
npm run test
npm run build
npm run preview
```

El build produce `dist/` y un `sw.js` con el contenido exacto a precargar. No caches respuestas de autenticación ni de la base de datos con el service worker. Las actualizaciones del service worker esperan el ciclo normal del navegador, sin recargar automáticamente una sesión con cambios pendientes.

## Estructura

```text
src/App.tsx          Interfaz, tareas, dashboard, calendario y ajustes
src/styles.css       Diseño responsive y temas
src/model.ts         Fechas, métricas, rachas y proyección de la cola
src/useFlow.ts       Caché, sesión, cola, sincronización y conflictos
src/supabase.ts      Cliente de acceso y base de datos
src/webmcp.ts        Acciones experimentales cuando el navegador las admite
supabase/schema.sql Backend, permisos y función de escritura
tests/               Pruebas de progreso y operaciones sin conexión
scripts/build-sw.mjs Precarga de la PWA
public/              Manifest, favicon e iconos instalables
vercel.json          Configuración de publicación
```

## Estado de entrega

Las comprobaciones realizadas y sus límites se detallan en [VALIDACION.md](VALIDACION.md).

El proyecto Supabase FLOW está instalado y sus pruebas de base de datos pasaron contra el servicio real. La app está publicada en https://flow-productividad.vercel.app (estado Listo confirmado por la captura del panel Vercel). El código está en martoscuevaalex-tech/flow-productividad, rama main. La conexión Git del proyecto Vercel sigue pendiente: pulsa Conectar Git en su panel y elige este repositorio. Consulta [DESPLIEGUE.md](DESPLIEGUE.md) y [VALIDACION.md](VALIDACION.md) para los recursos y límites de verificación.

WebMCP es experimental, se detecta antes de registrar herramientas y no es necesario para el funcionamiento. Se expone lectura de tareas, creación y marcado/desmarcado a través de las mismas acciones de la interfaz. No se presupone compatibilidad de todos los navegadores.

## Próximas mejoras sugeridas

Una vista de las tres prioridades del día y un temporizador Pomodoro. Conviene añadirlas después de usar esta primera versión y comprobar qué te ayuda más.
