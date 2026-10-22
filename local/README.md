# Servicio Comunitario IUNAV — Kit local de un clic

Este kit deja el sistema funcionando **en este equipo** sin tener que instalar PostgreSQL. Usa un PostgreSQL embebido que guarda sus datos en `local/.pgdata`.

## Requisitos

- **Node.js 20.9 o superior** (se recomienda la 22 LTS). Si no lo tienes, ábrelo con `winget install OpenJS.NodeJS.LTS` o desde [nodejs.org](https://nodejs.org/es/download).
- **Git** (para clonar o actualizar el proyecto).
- **Windows 10/11**.

## Primera vez (una sola vez)

1. Abre la carpeta `local/` del proyecto.
2. Haz doble clic en `instalar.cmd`.
3. Espera a que termine. Se instalarán las dependencias, se preparará la base de datos local y se cargarán los datos de ejemplo.

## Uso diario

- **Iniciar:** abre `local\iniciar.cmd` y espera a que se abra el navegador en [http://localhost:3000](http://localhost:3000).
- **Detener:** abre `local\detener.cmd` para cerrar todo (API, web y base de datos).

## Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `cmendoza@iunav.edu.ve` | `admin123` |
| Coordinador | `mlopez@iunav.edu.ve` | `coord123` |
| Tutor | `jperez@iunav.edu.ve` | `tutor123` |
| Estudiante | `gmartinez@iunav.edu.ve` | `est123` |

## Notas importantes

- **No hace falta tocar `server/.env`.** El kit exporta las variables en el entorno de los procesos. `server/.env` ya puede apuntar a otra base y no se modifica.
- **Los secretos se guardan una sola vez.** La contraseña de la base local y el secreto del JWT quedan en `local\.env.local` (no se sube al repositorio). Si ese archivo desaparece y también `local\.pgdata`, tendrás que empezar de cero.
- **Los datos son persistentes.** Todo lo que hagas queda guardado en `local\.pgdata`. Se borra solo si tú eliminas esa carpeta.
- **Puertos usados:** PostgreSQL embebido en `55432`, API en `4000`, web en `3000`. Si alguno está ocupado por otro programa, el instalador/iniciador te lo dirá.
- **`web\.env.local` solo se crea si no existe.** El kit no sobreescribe ese archivo.

## Comandos avanzados (desde una terminal)

Desde la carpeta `local/`:

```cmd
node pg.mjs start
node pg.mjs stop
node pg.mjs status
node pg.mjs ensure-db
```
