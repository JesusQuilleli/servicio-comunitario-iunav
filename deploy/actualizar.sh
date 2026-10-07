#!/usr/bin/env bash
#
# Despliegue de una version nueva que ya esta en el remoto de git.
#
#   cd /opt/iunav && sudo ./deploy/actualizar.sh
#   cd /opt/iunav && sudo ./deploy/actualizar.sh <rama>
#
# Que hace: git pull, recompila API y web, aplica el esquema, reinicia y
# comprueba que los dos servicios vuelven a responder. Si el chequeo falla, se
# sale con error y queda en el journal lo que paso.
#
# Decisiones ya tomadas (no reabrir):
# - `git pull --ff-only`: nunca genera un commit de merge en la VPS. Si el pull
#   no es fast-forward, el script para y avisa en vez de resolver el conflicto
#   en el servidor.
# - `npm ci` y no `npm install`: reinstala exactamente lo que dice el lockfile.
# - El esquema se aplica siempre. `sql/schema.sql` esta escrito con
#   `IF NOT EXISTS`, asi que es idempotente y no rompe una base ya poblada.

set -euo pipefail

RUTA_APP=/opt/iunav
USUARIO_APP=iunav
RAMA="${1:-}"

paso() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
nota() { printf '    %s\n' "$1"; }

cd "$RUTA_APP"

paso "Traiendo el codigo"
if [[ -n "$RAMA" ]]; then
  sudo -Hu "$USUARIO_APP" git fetch --all --prune
  sudo -Hu "$USUARIO_APP" git checkout "$RAMA"
fi
if ! sudo -Hu "$USUARIO_APP" git pull --ff-only; then
  echo >&2
  echo "El pull no fue fast-forward. Revisa si hay commits locales o una" >&2
  echo "divergencia, y haz el merge en una maquina de desarrollo, no aqui." >&2
  exit 1
fi
nota "Version desplegada: $(sudo -Hu "$USUARIO_APP" git rev-parse --short HEAD)"

paso "Compilando el API"
sudo -Hu "$USUARIO_APP" bash -c "cd $RUTA_APP/server && npm ci && npm run build"
test -f "$RUTA_APP/server/dist/index.js" || { echo "No se genero dist/index.js" >&2; exit 1; }

paso "Compilando la web"
# NEXT_PUBLIC_API_URL se incrusta en el bundle de Next, asi que hay que cargarlo
# en el entorno del build. Sin esto, una web ya compilada con otro dominio se
# seguiria apuntando al equivocado.
set -a
# shellcheck disable=SC1091
source /etc/iunav/web.env
set +a
# -E pasa las variables exportadas desde /etc/iunav/web.env, pero conserva el
# HOME de quien corre el script (root), y con HOME=/root el `npm ci` no puede
# escribir su cache. Se fija HOME a mano. Ademas se quita NODE_ENV: viene
# "production" desde web.env y con eso npm ci omitiria las dependencias de
# desarrollo (@tailwindcss/postcss y tailwindcss), que el build de Next NECESITA.
sudo -u "$USUARIO_APP" -E bash -c "export HOME=/var/lib/iunav; cd $RUTA_APP/web && unset NODE_ENV && npm ci && npm run build"
test -d "$RUTA_APP/web/.next" || { echo "El build de Next no genero .next" >&2; exit 1; }

paso "Aplicando el esquema"
sudo -Hu "$USUARIO_APP" bash -c "cd $RUTA_APP/server && npm run db:schema"

paso "Permisos y reinicio"
# El pull deja los archivos con el uid de quien hizo el pull; esto los devuelve
# al usuario de servicio para que `ProtectSystem=strict` no bloquee las subidas.
chown -R "$USUARIO_APP:$USUARIO_APP" "$RUTA_APP/server/uploads"
chown "$USUARIO_APP:$USUARIO_APP" /etc/iunav/web.env
systemctl restart iunav-api iunav-web

paso "Comprobando"
espera() {
  local url="$1" nombre="$2" intentos=30
  for _ in $(seq "$intentos"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "    $nombre responde."
      return 0
    fi
    sleep 1
  done
  echo "    $nombre NO respondio tras ${intentos}s." >&2
  journalctl -u "$3" -n 40 --no-pager >&2 || true
  return 1
}
espera "http://127.0.0.1:4000/api/health" "API + PostgreSQL" "iunav-api"
espera "http://127.0.0.1:3000/login" "web" "iunav-web"
curl -fsS "http://127.0.0.1:4000/api/health"; echo

DOMINIO="$(awk '/^[^#[:space:]]/ && / \{$/ { print $1; exit }' /etc/caddy/Caddyfile)"
echo "Actualizado y en linea en https://$DOMINIO"