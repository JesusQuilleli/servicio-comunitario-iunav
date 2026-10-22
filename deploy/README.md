# Despliegue en VPS (Ubuntu 22.04)

Guion para montar el sistema en una VPS personal de pruebas, con subdominio
propio y TLS automatico. Asumo Ubuntu 22.04, 2 GB de RAM o mas, y que el
subdominio ya apunta por DNS a la IP de la VPS.

## Datos de esta VPS

| Dato | Valor |
|---|---|
| Subdominio | `iunav-service.shop-mg.com` |
| IP publica | `166.0.112.206` |
| URL final | `https://iunav-service.shop-mg.com` |
| Remoto git | `git@github.com:JesusQuilleli/servicio-comunitario-iunav.git` (privado) |

## Resumen en una pantalla

| # | Qué | Comando / acción | Se marca |
|---|---|---|---|
| 1 | Preparar la maquina | `adduser iunavadmin` · `usermod -aG sudo iunavadmin` | ☐ |
| 2 | DNS: registro **A** `iunav-service.shop-mg.com` → `166.0.112.206` | `dig +short iunav-service.shop-mg.com` | ☐ |
| 3 | Clave SSH de despliegue en GitHub y clonar en `/opt/iunav` | ver *Paso 3* | ☐ |
| 4 | Instalar todo (Node, Postgres, Caddy, systemd, firewall) | `sudo ./deploy/instalar.sh iunav-service.shop-mg.com` | ☐ |
| 4b | **Anotar** la contraseña de la base y el `JWT_SECRET` | salen en pantalla una sola vez | ☐ |
| 5 | Compilar, sembrar y arrancar | `sudo ./deploy/arrancar.sh --con-datos` | ☐ |
| 6 | Entrar y cambiar la clave de `admin123` | `https://iunav-service.shop-mg.com` | ☐ |
| 7 | Programar el respaldo diario | `sudo crontab -e` | ☐ |

Desplegar versiones nuevas: `sudo ./deploy/actualizar.sh`.

## Despliegue completo, listo para copiar

Todo el despliegue, asumiendo que el repo ya esta en GitHub y el DNS ya
resuelve:

```bash
# 1. Entrar a la VPS
ssh root@166.0.112.206

# 2. Usuario normal
adduser iunavadmin && usermod -aG sudo iunavadmin
su - iunavadmin
sudo apt-get update && sudo apt-get install -y git openssh-client

# 3. Comprobar el DNS (debe devolver 166.0.112.206)
dig +short iunav-service.shop-mg.com

# 4. Usuario de servicio, clave SSH de despliegue y clonado
#    El home del usuario va FUERA del repo: si viviera en /opt/iunav, la carpeta
#    .ssh dejaria el directorio no vacio y `git clone` se negaria a entrar.
id -u iunav 2>/dev/null || sudo adduser --system --group --home /var/lib/iunav --shell /usr/sbin/nologin iunav
sudo mkdir -p /var/lib/iunav /opt/iunav
sudo chown iunav:iunav /var/lib/iunav /opt/iunav
sudo -Hu iunav mkdir -p -m 700 /var/lib/iunav/.ssh
sudo -Hu iunav ssh-keygen -t ed25519 -N "" -C iunav-vps -f /var/lib/iunav/.ssh/id_ed25519
sudo -Hu iunav sh -c 'ssh-keyscan github.com >> /var/lib/iunav/.ssh/known_hosts'
echo "== pega esta llave en GitHub: Settings > Deploy keys > Add deploy key (solo lectura) =="
sudo cat /var/lib/iunav/.ssh/id_ed25519.pub
# ... pegas la llave aca y luego:
sudo -Hu iunav git clone git@github.com:JesusQuilleli/servicio-comunitario-iunav.git /opt/iunav

# 5. Instalar (anota la clave de la base y el JWT_SECRET)
cd /opt/iunav && sudo chmod +x deploy/*.sh
sudo ./deploy/instalar.sh iunav-service.shop-mg.com

# 6. Compilar, sembrar datos y arrancar
sudo ./deploy/arrancar.sh --con-datos

# 7. Respaldo diario
sudo crontab -e     # anadir: 17 3 * * * /opt/iunav/deploy/backup.sh >> /var/log/iunav-backup.log 2>&1
```

Abre `https://iunav-service.shop-mg.com` y cambia la clave de `admin123`.

## Como queda

```
Internet ──> Caddy (:443, TLS)  ┬─ /api/*  ──> 127.0.0.1:4000   Express
                                 └─ /*       ──> 127.0.0.1:3000   Next.js

PostgreSQL 127.0.0.1:5432  (nunca expuesto)
/opt/iunav                  (codigo, propiedad de iunav)
/opt/iunav/server/uploads    (evidencias, firmas, sellos)
/var/lib/iunav               (home de iunav: llave SSH de despliegue)
/etc/iunav/server.env        (secretos, modo 640)
```

Un solo dominio para web y API. Al quedar en el mismo origen, CORS casi nunca se
activa y no hay cookie de sesion entre sitios distintos. Caddy es el unico proceso
que ve internet.

## Paso 1: preparar la maquina

VPS nueva, Ubuntu 22.04, recien creada. Con un servidor recien instalado la
primera sesion SSH suele pedir aceptar la huella del host; despues conviene
cambiar la contrasena de `root` y crear un usuario normal con sudo para no
trabajar como root:

```bash
adduser iunavadmin
usermod -aG sudo iunavadmin
su - iunavadmin
sudo apt-get update && sudo apt-get install -y git openssh-client
```

`openssh-client` hace falta para el paso 3: por defecto la VPS no trae el
cliente `ssh`.

## Paso 2: apuntar el DNS

Un registro **A** en el DNS de `shop-mg.com`:

```
Tipo A   Nombre: iunav-service   Valor: 166.0.112.206   TTL: 3600
```

Sin esto, el certificado de Let's Encrypt no se puede emitir y Caddy se queda
esperando. Verificar desde cualquier maquina:

```bash
dig +short iunav-service.shop-mg.com   # debe devolver 166.0.112.206
```

## Paso 3: subir el codigo

El codigo esta en un repo **privado**:

```
git@github.com:JesusQuilleli/servicio-comunitario-iunav.git
```

Como es privado, la VPS necesita credencial para clonarlo. La mas simple y la
mas segura es una **deploy key**: llave SSH de solo lectura, valida unicamente
para este repositorio y revocable en un clic. No es una contrasena de usuario
ni sirve para tocar nada mas. En GitHub no hay que generar tokens.

El codigo va en `/opt/iunav`, propiedad del usuario de sistema `iunav`. Todo
desde `iunavadmin`, con `sudo`. Ojo con el home del usuario: **no** va dentro
de `/opt/iunav`, porque entonces la carpeta `.ssh` dejaria el directorio no
vacio y `git clone` se negaria a entrar. Va en `/var/lib/iunav`.

```bash
id -u iunav 2>/dev/null || sudo adduser --system --group --home /var/lib/iunav --shell /usr/sbin/nologin iunav
sudo mkdir -p /var/lib/iunav /opt/iunav
sudo chown iunav:iunav /var/lib/iunav /opt/iunav
sudo -Hu iunav mkdir -p -m 700 /var/lib/iunav/.ssh
sudo -Hu iunav ssh-keygen -t ed25519 -N "" -C iunav-vps -f /var/lib/iunav/.ssh/id_ed25519
sudo -Hu iunav sh -c 'ssh-keyscan github.com >> /var/lib/iunav/.ssh/known_hosts'
sudo cat /var/lib/iunav/.ssh/id_ed25519.pub      # imprime la llave publica
```

Con esa llave publica, en GitHub: `JesusQuilleli/servicio-comunitario-iunav`
→ **Settings** → **Deploy keys** → **Add deploy key**, pegarla, marcar *Allow
read-only access* y **Add key**. Despues, de vuelta en la VPS:

```bash
sudo -Hu iunav git clone git@github.com:JesusQuilleli/servicio-comunitario-iunav.git /opt/iunav
```

Si el clon falla con `Permission denied (publickey)`, la llave no se pego bien
en GitHub o falto el `ssh-keyscan`. Repetir esas dos lineas.

El `-H` de `sudo` no es adorno: fija `HOME=/var/lib/iunav`, que es donde `git`
y `ssh` buscan la llave. Sin el, segun la version de sudo, podrian buscar en el
home de quien ejecuta el `sudo` y no encontrarla.

El codigo de desarrollo local no cambia: ahi sigue con su `origin` normal por
HTTPS. La deploy key solo vive en la VPS.

## Paso 4: instalar dependencias, base, TLS y firewall

```bash
cd /opt/iunav
sudo chmod +x deploy/*.sh           # por si el bit de ejecucion no viajo en el clon
sudo ./deploy/instalar.sh iunav-service.shop-mg.com
```

Instala Node 22 (el apt de Ubuntu 22.04 trae Node 12 y Next 16 exige 20.9 o
mas), PostgreSQL escuchando solo en localhost, el usuario de servicio, la base
`app_iunav` y la de pruebas `app_iunav_test`, Caddy con el certificado, las
unidades systemd y el cortafuegos con solo 22, 80 y 443 abiertos.

**Anota los dos valores que imprime al final**: la contrasena de la base y el
`JWT_SECRET`. Se muestran una sola vez y no estan en ningun archivo del repo.

Opcional, para que los datos seed no dejen las claves publicas:

```bash
IUNAV_DB_PASSWORD='...' sudo -E ./deploy/instalar.sh iunav-service.shop-mg.com
```

## Paso 5: compilar, sembrar y arrancar

```bash
sudo ./deploy/arrancar.sh --con-datos
```

Compila API y web, aplica `sql/schema.sql`, siembra los datos de prueba y levanta
los servicios. Al final espera a que `/api/health` responda 200 y a que la web
sirva `/login`; si algo no sube, imprime el journal del servicio que fallo.

## Paso 6: entrar

`https://iunav-service.shop-mg.com`, como `cmendoza@iunav.edu.ve` / `admin123`.

**Cambia esa clave en el primer inicio.** La VPS es publica y la contrasena esta
publicada en este repositorio.

## Paso 7: respaldos

```bash
sudo crontab -e
# anadir:
17 3 * * * /opt/iunav/deploy/backup.sh >> /var/log/iunav-backup.log 2>&1
```

Deja un `pg_dump` y un tar de `uploads/` en `/var/backups/iunav`, podando lo de
mas de 14 dias. Las copias quedan **en el mismo disco que los datos**: para
protegerse de perder el disco hay que copiar `/var/backups/iunav` a otra maquina.

## Despliegues siguientes

Con el codigo ya subido y la deploy key instalada, una sola linea:

```bash
cd /opt/iunav && sudo ./deploy/actualizar.sh          # rama por defecto
cd /opt/iunav && sudo ./deploy/actualizar.sh <rama>   # otra rama
```

`actualizar.sh` hace el `git pull --ff-only` **como el usuario `iunav`**, que es
el dueño de la llave SSH: un `git pull` hecho como root o como `iunavadmin` no
encontraria la llave y fallaria con `Permission denied (publickey)`.

`git pull --ff-only` a proposito: nunca resuelve conflictos en el servidor. El
script recompila, aplica el esquema, reinicia y comprueba que ambos servicios
responden antes de decir que termino.

## Operacion del dia a dia

```bash
systemctl status iunav-api iunav-web   # estado
journalctl -u iunav-api -f             # logs en vivo
journalctl -u iunav-web --since "1 hour ago"
sudo systemctl restart iunav-api       # reiniciar uno
curl -s localhost:4000/api/health      # sonda: 200 si API y base responden
```

Los logs van a journald, no a archivos. `sudo journalctl -u iunav-api -f`.

## Rotación de secretos

Esta seccion dice **que** rotar, **donde** vive cada valor y **cuando** hacerlo.
Los valores reales **no viven en el repo** ni se pegan aqui: en la VPS estan en
`/etc/iunav/server.env` (modo 640, grupo `iunav`) y en el panel del proveedor que
corresponda. Los nombres que aparecen abajo (`TU_SMTP_HOST`, etc.) son
marcadores de posicion, no valores reales.

| Secreto | Donde vive | Cuando rotar | Que queda invalidado |
|---|---|---|---|
| Contrasena del proyecto Supabase | Panel de Supabase (fuera del repo) | Una vez, antes de publicar o de dar acceso; el historial git antiguo la contuvo | Nada del codigo actual: el proyecto ya no se usa (ver `HANDOFF.md` §8) |
| `JWT_SECRET` | `/etc/iunav/server.env` (VPS); en local, `server/.env` | Si se filtra, si sale alguien con acceso, o por calendario | **Todos** los JWT: cada sesion abierta deja de valer y todos vuelven a entrar |
| Credenciales SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) | `/etc/iunav/server.env` (cuando existan, tarea C19) | Si el proveedor las revoca, cambia de proveedor, o hay sospecha de filtracion | Nada persistido: solo hay que reescribirlas y reiniciar el API |
| Contrasena inicial del seed / admin | Semilla en `server/src/db/seed.ts` (publicada en el repo) | En el **primer ingreso** tras `--con-datos`, obligatorio en una VPS publica | No invalida JWT (sin revocacion hoy): hay que cerrar sesion en los equipos afectados |

### Contrasena del proyecto Supabase

El proyecto Supabase ya no se usa: `server/sql/schema.sql` y `.env.example`
apuntan a PostgreSQL local y no queda rastro en el codigo. **Lo unico pendiente
esta fuera del codigo:** la contrasena del panel de Supabase, que el historial
git antiguo llego a contener (ver `HANDOFF.md` §8). Rotarla (o eliminar el
proyecto si ya no se necesita) es una accion de una sola vez en el panel de
Supabase, con la cuenta propietaria. No toca este repositorio ni los servicios de
la VPS: **no hay nada que reiniciar**.

### `JWT_SECRET`

Vive en `/etc/iunav/server.env` (lo genera `deploy/instalar.sh` y lo imprime una
sola vez) y, en desarrollo, en `server/.env`. En la VPS:

```bash
# 1. Editar el valor de JWT_SECRET (sin pegarlo en el repo ni en el chat)
sudo nano /etc/iunav/server.env

# 2. Reiniciar el API para que lo relea
sudo systemctl restart iunav-api
curl -s localhost:4000/api/health      # debe responder 200
```

**Impacto:** el token esta firmado con este secreto, asi que al cambiarlo se
invalida **todo** lo emitido: cada usuario con la sesion abierta queda fuera y
tiene que volver a entrar con su contrasena. No hace falta tocar la web ni
recompilar nada (el secreto no llega al bundle del navegador); basta reiniciar el
API. `deploy/arrancar.sh` tambien lo relee porque lee `/etc/iunav/server.env`,
pero para solo rotar el secreto no hace falta recompilar.

### Credenciales SMTP (cuando existan)

Cuando el envio real de correo este implementado (tarea C19, hoy bloqueada por
falta de proveedor), las cinco variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS` y `MAIL_FROM` viviran tambien en `/etc/iunav/server.env`, con
marcadores como `SMTP_HOST=TU_SMTP_HOST`. Se rotan en el panel del proveedor
SMTP y se reescriben en ese archivo; despues, reiniciar el API:

```bash
sudo systemctl restart iunav-api
```

**Impacto:** rotarlas no invalida datos ni sesiones; solo hace falta reiniciar
para que el proceso tome los valores nuevos. Si el proveedor entrega un usuario
o una clave nueva, actualizar las cinco (incluido `MAIL_FROM`, que debe seguir
siendo una direccion propia del proyecto).

### Contrasena inicial del seed / admin

`deploy/arrancar.sh --con-datos` siembra cuentas de prueba cuyas claves estan
publicadas en el repo (`server/src/db/seed.ts`). Antes de exponer la VPS hay que
**cambiar la clave del admin en el primer ingreso** (y, si aplica, la de las
demas cuentas). El cambio se hace desde la propia aplicacion, ya autenticado como
ese usuario.

**Impacto:** como hoy el JWT no tiene revocacion, cambiar la contrasena **no**
expulsa a quien tenga un token vigente: si se rota una clave por filtracion,
tambien hay que rotar `JWT_SECRET` (arriba) para cortar las sesiones vivas.

### Comprobar que el repo quedo sin valores

Ningun secreto real debe quedar en `deploy/` ni en `docs/`. Antes de publicar:

```bash
grep -rniE 'password|secret|smtp_pass|jwt_secret|api[_-]?key' deploy docs \
  --include='*.sh' --include='*.md' --include='*.env*' --include='*.html'
```

El resultado solo debe mostrar **nombres** de variable, marcadores
(`TU_SMTP_HOST`, `...`) y las cuentas de prueba ya documentadas; ningun valor
secreto.

## Si algo falla

| Sintoma | Causa casi segura |
|---|---|
| La web dice "No se pudo conectar con el servidor" | La API esta caida: `systemctl status iunav-api`. Si arranca y se cae, casi siempre es `DATABASE_URL` mal escrita en `/etc/iunav/server.env` |
| El navegador dice "certificado no valido" | El DNS todavia no apunta a la VPS, o falta esperar unos minutos a que Let's Encrypt reintente |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL no esta escuchando, o `DB_SSL=true` contra un Postgres local sin TLS |
| `relation "usuarios" does not exist` | No se aplico `sql/schema.sql`: `cd server && npm run db:schema` |
| La web carga pero toda llamada va a `localhost:4000` | Se compilo sin `NEXT_PUBLIC_API_URL`: `sudo ./deploy/actualizar.sh` la carga desde `/etc/iunav/web.env` |
| 413 al subir un archivo grande | Tope de Caddy (30 MB en `deploy/Caddyfile`) o de multer: `MAX_EVIDENCIA_MB` / `MAX_DOCUMENTO_MB` en `/etc/iunav/server.env` |
| 502 en cualquier pagina | El servicio de esa mitad no esta arriba: revisar `iunav-web` o `iunav-api` |
| `Permission denied (publickey)` al clonar o al actualizar | Falta la deploy key en GitHub, o se hizo el `git` como otro usuario que no es `iunav` |

## Lo que este despliegue NO cubre

Decisiones que quedan pendientes y conviene tener presentes:

- **Migraciones sin version.** `sql/schema.sql` se reaplica entero y es
  idempotente, asi que funciona mientras solo se creen tablas o se agreguen
  columnas. Un cambio destructivo (renombrar, borrar columna) no lo cubre
  `IF NOT EXISTS`: hay que editarlo a mano sobre una base viva.
- **Rate limit en memoria.** El store de `express-rate-limit` es por proceso:
  se reinicia con el servicio y se multiplica por numero de instancias. Con un
  solo nodo aguanta; con dos, el limite real seria el doble.
- **JWT en `localStorage`.** Se robo en caso de XSS y no hay revocacion: cerrar
  sesion no invalida el token en el servidor, solo lo borra del navegador. Para
  una herramienta interna cerrada se acepta; no lo es para datos de estudiantes
  en un servidor abierto. La migracion seria cookie `httpOnly` + `Secure` +
  `SameSite=Lax`.
- **Sin CSP.** Next inyecta scripts de arranque en linea, asi que una CSP
  razonable los bloquearia. Anadirla requiere nonce o hash de las ramas
  experimentales de Next.
- **Reportes en memoria.** Cada PDF y cada Excel se construye entero en RAM al
  pedirlos. Con varios tutores pidiendo consolidado a la vez, en 2 GB puede
  haber OOM. Si se ve, el arreglo es limitar concurrencia o mover la generacion
  a un trabajo en segundo plano.
- **Sin observabilidad.** Solo journald. No hay metricas ni alertas. Para
  recibir avisos hay que montar un exporter de Prometheus o un watchdog externo
  contra `/api/health`.