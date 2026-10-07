#!/usr/bin/env bash
#
# Primer arranque despues de deploy/instalar.sh: compila, crea el esquema,
# siembra datos de prueba y levanta los dos servicios.
#
#   cd /opt/iunav && sudo ./deploy/arrancar.sh
#   cd /opt/iunav && sudo ./deploy/arrancar.sh --con-datos    # ademas siembra
#
# Para actualizar el codigo en los siguientes despliegues usar deploy/actualizar.sh.

set -euo pipefail

RUTA_APP=/opt/iunav
USUARIO_APP=iunav
CON_DATOS=false
[[ "${1:-}" == "--con-datos" ]] && CON_DATOS=true

paso() { printf '\n\033[1;34m==> %s\033[0m\n' "$1"; }
nota() { printf '    %s\n' "$1"; }

paso "Compilando el API"
sudo -Hu "$USUARIO_APP" bash -c "cd $RUTA_APP/server && npm ci && npm run build"
test -f "$RUTA_APP/server/dist/index.js" || { echo "No se genero dist/index.js" >&2; exit 1; }

paso "Compilando la web"
# NEXT_PUBLIC_API_URL vive en /etc/iunav/web.env y se carga aqui porque Next lo
# incrusta en el bundle al compilar. Sin esto, la web se compila apuntando a
# localhost:4000 y publicada no encuentra la API.
set -a
# shellcheck disable=SC1091
source /etc/iunav/web.env
set +a
# -E pasa las variables exportadas desde /etc/iunav/web.env, pero conserva el
# HOME de quien corre el script (root), y con HOME=/root el `npm ci` no puede
# escribir su cache. Se fija HOME a mano. Ademas se quita NODE_ENV: viene
# "production" desde web.env y con eso npm ci omitiria las dependencias de
# desarrollo (@tailwindcss/postcss y tailwindcss), que el build de Next NECESITA.
# `next build` fija NODE_ENV=production el solo.
sudo -u "$USUARIO_APP" -E bash -c "export HOME=/var/lib/iunav; cd $RUTA_APP/web && unset NODE_ENV && npm ci && npm run build"
test -d "$RUTA_APP/web/.next" || { echo "El build de Next no genero .next" >&2; exit 1; }

paso "Creando el esquema"
sudo -Hu "$USUARIO_APP" bash -c "cd $RUTA_APP/server && npm run db:schema"

if $CON_DATOS; then
  paso "Sembrando datos de prueba"
  # Las contrasenas de este seed (admin123, coord123, tutor123, est123) estan
  # publicadas en el repo. En una VPS personal de pruebas es lo que se quiere;
  # en el servidor del IUNAV habria que cambiar la clave del admin nada mas
  # entrar por primera vez.
  sudo -Hu "$USUARIO_APP" bash -c "cd $RUTA_APP/server && npm run db:seed -- --confirm-seed"
  echo
  echo "    Cuentas creadas. Entrar como admin@iunav.edu.ve / admin123"
  echo "    (cambiar esa clave en el primer inicio si la VPS es publica)"
  echo
else
  paso "Sin sembrar datos"
  nota "La base queda con solo el esquema y la tabla de configuracion."
  nota "Para meter datos de prueba: sudo ./deploy/arrancar.sh --con-datos"
fi

paso "Permisos y arranque"
chown -R "$USUARIO_APP:$USUARIO_APP" "$RUTA_APP/server/uploads"
systemctl restart iunav-api iunav-web

paso "Esperando que respondan"
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
  journalctl -u "$3" -n 30 --no-pager >&2 || true
  return 1
}

# /api/health ahora consulta PostgreSQL de verdad: si responde 200 es que el
# proceso vive Y la base esta accesible.
espera "http://127.0.0.1:4000/api/health" "API + PostgreSQL" "iunav-api"
espera "http://127.0.0.1:3000/login" "web" "iunav-web"

echo
curl -fsS "http://127.0.0.1:4000/api/health"; echo
echo
# El primer token del Caddyfile es el dominio. awk en vez de grep -P para no
# depender de que grep traiga soporte PCRE.
DOMINIO="$(awk '/^[^#[:space:]]/ && / \{$/ { print $1; exit }' /etc/caddy/Caddyfile)"
echo "Listo. Entra en https://$DOMINIO"
echo
systemctl --no-pager --lines=0 status iunav-api iunav-web || true