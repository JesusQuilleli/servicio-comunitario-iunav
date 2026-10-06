#!/usr/bin/env bash
#
# Copia de seguridad de la base y de los archivos subidos.
#
#   sudo ./deploy/backup.sh              # un dump a /var/backups/iunav
#   RETENCION_DIAS=30 sudo ./deploy/backup.sh
#
# Se instala en cron con:
#   sudo crontab -e     y anadir:
#   17 3 * * * /opt/iunav/deploy/backup.sh >> /var/log/iunav-backup.log 2>&1
#
# Decisiones ya tomadas (no reabrir):
# - `pg_dump -Fc`: formato custom de postgres, que se restaura con `pg_restore`
#   y permite `pg_restore --list` para inspeccionar el archivo antes de usarlo.
# - Se respalda la base y `uploads/` juntos. Si solo se guardara uno, un restore
#   parcial dejaria evidencias huerfanas apuntando a archivos que no existen.
# - Los dumps mas viejos que RETENCION_DIAS se borran. Sin esto, el disco de una
#   VPS pequena se llena solo con copias viejas.

set -euo pipefail

DB_NOMBRE="${DB_NOMBRE:-app_iunav}"
DESTINO="${DESTINO:-/var/backups/iunav}"
RETENCION_DIAS="${RETENCION_DIAS:-14}"
RUTA_APP=/opt/iunav
FECHA="$(date +%Y%m%d-%H%M%S)"

# Los dumps y los archivos de estudiantes son datos personales: solo root puede
# leerlos.
umask 077
mkdir -p "$DESTINO"

echo "[$FECHA] Volcando $DB_NOMBRE"
sudo -u postgres pg_dump -Fc -d "$DB_NOMBRE" > "$DESTINO/db-$FECHA.dump"
test -s "$DESTINO/db-$FECHA.dump" || { echo "El dump quedo vacio: no se respalda nada mas" >&2; exit 1; }

if [[ -d "$RUTA_APP/server/uploads" ]]; then
  echo "[$FECHA] Empaquetando uploads/"
  tar -czf "$DESTINO/uploads-$FECHA.tar.gz" -C "$RUTA_APP/server" uploads
else
  echo "[$FECHA] No hay carpeta uploads/, se omite"
fi

echo "[$FECHA] Podando copias de mas de $RETENCION_DIAS dias"
find "$DESTINO" -name 'db-*.dump' -type f -mtime "+$RETENCION_DIAS" -delete
find "$DESTINO" -name 'uploads-*.tar.gz' -type f -mtime "+$RETENCION_DIAS" -delete

echo "[$FECHA] Listo:"
ls -lh "$DESTINO" | tail -n 5

# Aviso honesto: esto deja la copia en el mismo disco que los datos originales.
# Si el disco muere, se pierden base y archivos juntos. Para protegerse de eso
# hay que copiar $DESTINO a otro sitio (rsync a otra maquina, o un bucket).
if [[ -z "${IUNAV_BACKUP_COPIA_ADONDE:-}" ]]; then
  echo
  echo "AVISO: las copias siguen en el mismo disco que los datos. Copia"
  echo "$DESTINO a otra maquina o a un bucket, o el backup no protege de nada."
fi