#!/usr/bin/env bash
#
# Primera instalacion del sistema en una VPS Ubuntu 22.04 (vacia).
#
#   sudo ./deploy/instalar.sh iunav-service.shop-mg.com
#
# Es idempotente en lo que se puede: se puede volver a correr para reinstalar lo
# que falte. NO borra la base ni los archivos subidos.
#
# Que hace, en orden:
#   1. Node 22 (el apt de Ubuntu 22.04 trae Node 12; Next 16 exige >= 20.9)
#   2. PostgreSQL, escuchando solo en localhost
#   3. Usuario de sistema `iunav` (home en /var/lib/iunav) y arbol /opt/iunav
#   4. Base de datos de la app y la de pruebas
#   5. Caddy con el certificado TLS
#   6. Unidades systemd
#   7. Cortafuegos: solo 22, 80 y 443
#
# Lo que NO hace, y hay que hacer a mano: la llave SSH de despliegue y el
# `git clone` del codigo (paso 3 del README). El repo es privado, asi que sin
# esa llave el clone falla con Permission denied.

set -euo pipefail

DOMINIO="${1:-}"
if [[ -z "$DOMINIO" ]]; then
  echo "Uso: sudo $0 iunav-service.shop-mg.com" >&2
  echo "El subdominio debe apuntar por DNS a la IP publica de esta VPS." >&2
  exit 1
fi

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ORIGEN="$RAIZ"
DB_NOMBRE="${DB_NOMBRE:-app_iunav}"
DB_PRUEBAS="${DB_PRUEBAS:-app_iunav_test}"
USUARIO_APP="iunav"
RUTA_APP="/opt/iunav"

paso() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
nota() { printf '    %s\n' "$1"; }

paso "1/7 Node 22"
if node -v 2>/dev/null | grep -qE '^v(2[2-9]|[3-9][0-9])'; then
  nota "Ya hay $(node -v). Se respeta."
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  nota "Instalado $(node -v)."
fi

paso "2/7 PostgreSQL en localhost"
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql
VERSION_PG="$(ls /etc/postgresql | sort -V | tail -1)"
CONF_PG="/etc/postgresql/$VERSION_PG/main/postgresql.conf"
# Por defecto Ubuntu ya escucha solo en localhost. Se deja explicito porque un
# `listen_addresses = '*'` por error publica la base de datos de estudiantes.
sed -i "s/^#\?listen_addresses.*/listen_addresses = 'localhost'/" "$CONF_PG"
sed -i "s/^#\?port\s*=.*/port = 5432/" "$CONF_PG"
systemctl restart "postgresql@$VERSION_PG-main"
nota "PostgreSQL $VERSION_PG escuchando solo en localhost:5432."

paso "3/7 Usuario de sistema y arbol del proyecto"
# El home va en /var/lib/iunav y NO en $RUTA_APP: si el home estuviera dentro
# del repo, la carpeta .ssh dejaria /opt/iunav no vacio y `git clone` se
# negaria a entrar. Ademas, ssh busca la deploy key en $HOME/.ssh.
if ! id -u "$USUARIO_APP" >/dev/null 2>&1; then
  adduser --system --group --home /var/lib/iunav --shell /usr/sbin/nologin "$USUARIO_APP"
  nota "Usuario $USUARIO_APP creado, sin login, home en /var/lib/iunav."
fi
mkdir -p /var/lib/iunav
chown "$USUARIO_APP:$USUARIO_APP" /var/lib/iunav
if [[ ! -d "$RUTA_APP/.git" ]]; then
  echo >&2
  echo "ERROR: $RUTA_APP no es un repositorio git." >&2
  echo "Clona el codigo primero (ver deploy/README.md, paso 3, que incluye la" >&2
  echo "llave SSH de despliegue que pide el repo privado):" >&2
  echo "  sudo mkdir -p /var/lib/iunav $RUTA_APP && sudo chown $USUARIO_APP:$USUARIO_APP /var/lib/iunav $RUTA_APP" >&2
  echo "  sudo -Hu $USUARIO_APP mkdir -p -m 700 /var/lib/iunav/.ssh" >&2
  echo "  sudo -Hu $USUARIO_APP ssh-keygen -t ed25519 -N '' -f /var/lib/iunav/.ssh/id_ed25519" >&2
  echo "  sudo cat /var/lib/iunav/.ssh/id_ed25519.pub   # pegarla en GitHub > Deploy keys" >&2
  echo "  sudo -Hu $USUARIO_APP git clone git@github.com:JesusQuilleli/servicio-comunitario-iunav.git $RUTA_APP" >&2
  exit 1
fi
mkdir -p /etc/iunav "$RUTA_APP/server/uploads"
chown -R "$USUARIO_APP:$USUARIO_APP" "$RUTA_APP"
nota "$RUTA_APP listo, propiedad de $USUARIO_APP."

paso "4/7 Bases de datos"
# La contrasena sale del entorno si se pasa; si no, se genera una y se imprime
# una sola vez. Nunca se escribe en un archivo del repo.
if [[ -n "${IUNAV_DB_PASSWORD:-}" ]]; then
  DB_PASSWORD="$IUNAV_DB_PASSWORD"
  DB_PASSWORD_MOSTRADA="(la que pasaste por IUNAV_DB_PASSWORD)"
else
  DB_PASSWORD="$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | cut -c1-24)"
  DB_PASSWORD_MOSTRADA="$DB_PASSWORD"
fi

psql_admin() { sudo -u postgres psql -v ON_ERROR_STOP=1 "$@"; }

if sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='$USUARIO_APP'" | grep -q 1; then
  nota "El rol $USUARIO_APP ya existia: solo se actualiza su contrasena."
else
  psql_admin -c "create role $USUARIO_APP login password '$DB_PASSWORD'" >/dev/null
fi
psql_admin -c "alter role $USUARIO_APP login password '$DB_PASSWORD'" >/dev/null

for base in "$DB_NOMBRE" "$DB_PRUEBAS"; do
  if sudo -u postgres psql -tAc "select 1 from pg_database where datname='$base'" | grep -q 1; then
    nota "La base $base ya existia."
  else
    psql_admin -c "create database $base owner $USUARIO_APP" >/dev/null
    nota "Base $base creada."
  fi
done

JWT_SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | cut -c1-48)"

cat > /etc/iunav/server.env <<EOF
# Generado por deploy/instalar.sh. NO versionar: contiene el secreto del API.
NODE_ENV=production
PORT=4000
# El API solo en loopback: quien entra es Caddy, no internet (ver deploy/Caddyfile).
API_HOST=127.0.0.1
# Sin SSL porque PostgreSQL esta en la misma maquina. Ojo: el default de
# src/config/env.ts es SSL ACTIVADO, asi que esta linea es obligatoria.
DB_SSL=false
DATABASE_URL=postgresql://$USUARIO_APP:$DB_PASSWORD@127.0.0.1:5432/$DB_NOMBRE
TEST_DATABASE_URL=postgresql://$USUARIO_APP:$DB_PASSWORD@127.0.0.1:5432/$DB_PRUEBAS
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=8h
# Mismo origen que la web: por eso CORS casi nunca llega a activarse.
FRONTEND_URL=https://$DOMINIO
UPLOAD_DIR=uploads
MAX_EVIDENCIA_MB=10
MAX_DOCUMENTO_MB=25
RATE_LIMIT_LOGIN=10
RATE_LIMIT_LOGIN_VENTANA_MS=900000
EOF

cat > /etc/iunav/web.env <<EOF
# Generado por deploy/instalar.sh.
# OJO: NEXT_PUBLIC_* se incrusta en el bundle del navegador al compilar. Cambiar
# el dominio obliga a recompilar la web, no basta con reiniciar el servicio.
NEXT_PUBLIC_API_URL=https://$DOMINIO
NODE_ENV=production
# HOSTNAME no va aqui: lo fija deploy/systemd/iunav-web.service, que lo necesita
# despues de este archivo para que Next escuche en loopback y no en la IP publica.
EOF

chmod 640 /etc/iunav/server.env
chown root:"$USUARIO_APP" /etc/iunav/server.env
chmod 640 /etc/iunav/web.env
nota "/etc/iunav/server.env y web.env escritos (modo 640, grupo $USUARIO_APP)."
echo
echo "    ============================================================"
echo "    ANOTA ESTOS VALORES, SOLO SE MUESTRAN AHORA:"
echo "      contrasena de la base : $DB_PASSWORD_MOSTRADA"
echo "      JWT_SECRET            : $JWT_SECRET"
echo "    ============================================================"
echo

paso "5/7 Caddy"
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
sed "s/__DOMINIO__/$DOMINIO/" "$ORIGEN/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy
nota "Caddy configurado para $DOMINIO."

paso "6/7 Unidades systemd"
cp "$ORIGEN/deploy/systemd/iunav-api.service" /etc/systemd/system/iunav-api.service
cp "$ORIGEN/deploy/systemd/iunav-web.service" /etc/systemd/system/iunav-web.service
systemctl daemon-reload
systemctl enable iunav-api iunav-web
nota "Servicios habilitados. Faltan el build y el arranque (ver README)."

paso "7/7 Cortafuegos"
apt-get install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose
nota "3000, 4000 y 5432 quedan cerrados. El trafico entra solo por 443."

echo
echo "Instalacion lista. Sigue con deploy/README.md desde el paso 2:"
echo "  cd $RUTA_APP && sudo ./deploy/arrancar.sh"