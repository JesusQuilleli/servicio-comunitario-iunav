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
| Remoto git | `https://github.com/<USUARIO>/servicio-comunitario-iunav.git` (privado) |

## Resumen en una pantalla

| # | Qué | Comando / acción | Se marca |
|---|---|---|---|
| 0 | Crear el remoto de git y commitear | `git remote -v` · `git add -A && git commit` | ☐ |
| 1 | Preparar la maquina | `adduser iunavadmin` · `usermod -aG sudo iunavadmin` | ☐ |
| 2 | DNS: registro **A** `iunav-service.shop-mg.com` → `166.0.112.206` | `dig +short iunav-service.shop-mg.com` | ☐ |
| 3 | Clonar el codigo en `/opt/iunav` | `sudo -u iunav git clone <REMOTO> /opt/iunav` | ☐ |
| 4 | Instalar todo (Node, Postgres, Caddy, systemd, firewall) | `sudo ./deploy/instalar.sh iunav-service.shop-mg.com` | ☐ |
| 4b | **Anotar** la contraseña de la base y el `JWT_SECRET` | salen en pantalla una sola vez | ☐ |
| 5 | Compilar, sembrar y arrancar | `sudo ./deploy/arrancar.sh --con-datos` | ☐ |
| 6 | Entrar y cambiar la clave de `admin123` | `https://iunav-service.shop-mg.com` | ☐ |
| 7 | Programar el respaldo diario | `sudo crontab -e` | ☐ |

Desplegar versiones nuevas: `sudo ./deploy/actualizar.sh`.

## Los cinco comandos, listos para copiar

Todo el despliegue, asumiendo que el repo ya esta en GitHub y el DNS ya
resuelve:

```bash
# 1. Entrar a la VPS
ssh root@166.0.112.206

# 2. Usuario normal + clonar
adduser iunavadmin && usermod -aG sudo iunavadmin
su - iunavadmin
sudo apt-get update && sudo apt-get install -y git
dig +short iunav-service.shop-mg.com        # debe devolver 166.0.112.206
sudo mkdir -p /opt/iunav
sudo useradd --system --group --home /opt/iunav --shell /usr/sbin/nologin iunav
sudo chown iunav:iunav /opt/iunav
sudo -u iunav git clone https://github.com/<USUARIO>/servicio-comunitario-iunav.git /opt/iunav

# 3. Instalar (anota la clave de la base y el JWT_SECRET)
cd /opt/iunav && chmod +x deploy/*.sh
sudo ./deploy/instalar.sh iunav-service.shop-mg.com

# 4. Compilar, sembrar datos y arrancar
sudo ./deploy/arrancar.sh --con-datos

# 5. Respaldo diario
sudo crontab -e     # anadir: 17 3 * * * /opt/iunav/deploy/backup.sh >> /var/log/iunav-backup.log 2>&1
```

Abre `https://iunav-service.shop-mg.com` y cambia la clave de `admin123`.

## Como queda

```
Internet ──> Caddy (:443, TLS)  ┬─ /api/*  ──> 127.0.0.1:4000   Express
                                 └─ /*       ──> 127.0.0.1:3000   Next.js

PostgreSQL 127.0.0.1:5432  (nunca expuesto)
/opt/iunav/server/uploads    (evidencias, firmas, sellos)
/etc/iunav/server.env        (secretos, modo 640)
```

Un solo dominio para web y API. Al quedar en el mismo origen, CORS casi nunca se
activa y no hay cookie de sesion entre sitios distintos. Caddy es el unico proceso
que ve internet.

## Paso 0: el remoto de git, antes que nada

El repositorio hoy **no tiene remoto** y tiene 42 modificados, 39 borrados y 40
archivos nuevos sin commitear. Sin commit previo, no hay nada que clonar.

```bash
git remote -v                       # si no sale nada, no hay remoto
```

Hay que crear un remoto **privado**. No publico: en el historial esta la
contraseña de Supabase que se borro del arbol de trabajo pero sigue en los
commits viejos. Ademas, un remoto publico de un repositorio de una
universidad con datos de estudiantes es una decision que no se toma por
accidente.

Si ese proyecto de Supabase ya no se usa, rota la contrasena antes de publicar
el repo en cualquier sitio.

## Paso 1: preparar la maquina

VPS nueva, Ubuntu 22.04, recien creada. Con un servidor recien instalado la
primera sesion SSH suele pedir aceptar la huella del host; despues conviene
cambiar la contrasena de `root` y crear un usuario normal con sudo para no
trabajar como root:

```bash
adduser iunavadmin
usermod -aG sudo iunavadmin
```

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

El codigo va en `/opt/iunav`, propiedad del usuario de sistema `iunav`:

```bash
sudo apt-get update
sudo mkdir -p /opt/iunav
sudo useradd --system --group --home /opt/iunav --shell /usr/sbin/nologin iunav
sudo chown iunav:iunav /opt/iunav
sudo -u iunav git clone <REMOTO-PRIVADO> /opt/iunav
```

## Paso 4: instalar dependencias, base, TLS y firewall

```bash
cd /opt/iunav
chmod +x deploy/*.sh              # solo si el bit de ejecucion se perdio al clonar
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

`https://iunav-service.shop-mg.com`, como `admin@iunav.edu.ve` / `admin123`.

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

Con el codigo ya en el remoto:

```bash
cd /opt/iunav
git pull              # o: sudo ./deploy/actualizar.sh <rama>
sudo ./deploy/actualizar.sh
```

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