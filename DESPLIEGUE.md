# Recursos de FLOW de Alex

## Supabase

- Proyecto: FLOW.
- Referencia: `ldylxkaoxftboijsiuwz`.
- Región: São Paulo (`sa-east-1`).
- [Abrir proyecto](https://supabase.com/dashboard/project/ldylxkaoxftboijsiuwz).
- Coste consultado al crearlo: US$0/mes, plan Free.
- Esquema instalado mediante la migración `flow_initial_daily_routines`.
- Pruebas de permisos y rutinas ejecutadas contra el servicio real y revertidas después.
- La app incluye la URL y la clave publicable en `src/public-config.ts`. No incluye claves secretas.

## Acceso a tu cuenta

1. Abre FLOW en el dispositivo donde quieres usarla y entra a Ajustes.
2. Solicita el enlace con el mismo correo en todos tus dispositivos.
3. Puedes copiar el enlace del botón de acceso del correo y pegarlo en **Entrar pegando el enlace del correo**. Así puedes verificar el correo directamente en este dispositivo sin depender de la redirección del correo.
4. Si tenías tareas locales, pulsa **Añadir mis tareas locales** después de entrar.
5. Espera a **Sincronizado** y comprueba una tarea en el segundo dispositivo.

Para que un clic en el correo abra directamente FLOW, configura [Authentication → URL Configuration](https://supabase.com/dashboard/project/ldylxkaoxftboijsiuwz/auth/url-configuration) con la URL estable de producción en **Site URL** y **Redirect URLs**. La opción de pegar el enlace funciona mientras esa redirección se configura. No se enviaron correos ni se creó una cuenta de acceso real durante la verificación.

## Vercel

- Proyecto: `flow-productividad`.
- Equipo: `martoscuevaalex-2793s-projects`.
- [Proyecto](https://vercel.com/martoscuevaalex-2793s-projects/flow-productividad).
- [FLOW publicada](https://flow-productividad.vercel.app).
- Última actualización conectada a Supabase: `dpl_ErRUT786AZU64ETP3nGG3DvWe3wf`.
- [Inspeccionar actualización](https://vercel.com/martoscuevaalex-2793s-projects/flow-productividad/ErRUT786AZU64ETP3nGG3DvWe3wf).
- La captura del panel Vercel confirmó el estado Listo y el dominio de producción. La conexión de ChatGPT todavía recibe 403 al administrar el proyecto. El inicio de sesión por correo y la sincronización en dos dispositivos reales no se han comprobado desde este entorno.

## GitHub

[Repositorio FLOW](https://github.com/martoscuevaalex-tech/flow-productividad), rama `main`. Incluye el código fuente, esquema Supabase, pruebas y configuración PWA. La autorización del conector ChatGPT Codex permite escribir en este repositorio.

En [el panel Vercel](https://vercel.com/martoscuevaalex-2793s-projects/flow-productividad), pulsa **Conectar Git**, selecciona GitHub y elige `martoscuevaalex-tech/flow-productividad`. Usa `main` como rama de producción y la raíz como directorio. Framework Vite; build `npm run build`; salida `dist`. La configuración de Supabase ya está incluida mediante la clave publicable en `src/public-config.ts`. Esta vinculación permite publicar automáticamente los commits siguientes.

Consulta [VALIDACION.md](VALIDACION.md) para los límites de verificación.
