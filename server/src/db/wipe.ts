import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import { pool } from './pool.js';
import { CARPETA_ARCHIVOS } from '../config/almacenamiento.js';

/**
 * Vacia la base de datos dejando solo:
 *   - un unico administrador (clave reseteada a `admin123`),
 *   - `configuracion_sistema` y `plantillas_documento` (configuracion del programa),
 *   - los periodos academicos vigentes (los que estan activos o referenciados).
 *
 * Borra todos los demas datos (usuarios, proyectos, bitacoras, servicios,
 * solicitudes) en orden de claves foraneas y limpia la carpeta de archivos
 * subidos (`server/uploads/`).
 *
 * Por la misma razon que el seed: destruye datos de golpe, asi que exige la
 * bandera `--confirm-wipe` y se niega a correr contra una base de pruebas
 * (cuyo nombre termine en `_test`).
 */
function confirmarWipe(): void {
  if (process.argv.includes('--confirm-wipe')) return;

  console.error('Este script BORRA todos los datos de la base de datos (usuarios,');
  console.error('proyectos, bitacoras, servicios y archivos subidos).');
  console.error('Para continuar, ejecuta:  npm run db:wipe -- --confirm-wipe');
  process.exit(1);
}

const ADMIN_EMAIL = 'admin@iunav.edu.ve';
const ADMIN_NOMBRE = 'Administrador IUNAV';
const ADMIN_CEDULA = 'V-00.000.000';
const ADMIN_PASSWORD = 'admin123';

interface Conteo {
  [tabla: string]: number;
}

async function contar(): Promise<Conteo> {
  const tablas = [
    'usuarios',
    'grupos_proyectos',
    'integrantes_grupo',
    'bitacoras_comunitario',
    'control_servicios_institucionales',
    'solicitudes_cambio',
    'periodos_academicos',
  ];
  const conteo: Conteo = {};
  for (const tabla of tablas) {
    const { rows } = await pool.query<{ count: string }>(`select count(*)::text as count from ${tabla}`);
    conteo[tabla] = Number(rows[0]?.count ?? 0);
  }
  return conteo;
}

async function main(): Promise<void> {
  confirmarWipe();

  const { rows: baseRows } = await pool.query<{ nombre: string }>(
    'select current_database() as nombre'
  );
  const base = baseRows[0]?.nombre ?? '';
  if (base.endsWith('_test')) {
    console.error(`La base "${base}" parece ser de pruebas (termina en _test).`);
    console.error('Este script no corre contra bases de pruebas; usa npm run db:test.');
    process.exit(1);
  }

  console.log(`Vaciando la base de datos "${base}"...`);
  const antes = await contar();
  for (const [tabla, total] of Object.entries(antes)) {
    console.log(`  - ${tabla}: ${total} fila(s)`);
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('begin');

    // 1. Unico admin que sobrevive al wipe.
    const { rows: adminRows } = await cliente.query<{ id_usuario: string }>(
      `select id_usuario from usuarios where rol = 'admin' order by creado_en asc limit 1`
    );
    let idAdmin = adminRows[0]?.id_usuario;
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    if (idAdmin) {
      await cliente.query(
        `update usuarios
            set password_hash = $1, password_temporal = false,
                password_cambiado_en = now(), activo = true
          where id_usuario = $2`,
        [hash, idAdmin]
      );
      console.log(`  = admin conservado (${ADMIN_PASSWORD} reinstalada)`);
    } else {
      const creado = await cliente.query<{ id_usuario: string }>(
        `insert into usuarios (nombre_completo, cedula, email, password_hash, rol)
         values ($1, $2, $3, $4, 'admin')
         returning id_usuario`,
        [ADMIN_NOMBRE, ADMIN_CEDULA, ADMIN_EMAIL, hash]
      );
      idAdmin = creado.rows[0].id_usuario;
      console.log(`  + admin creado (${ADMIN_EMAIL} / ${ADMIN_PASSWORD})`);
    }

    // 2. Datos que dependen de usuarios y grupos (hijos primero).
    await cliente.query('delete from solicitudes_cambio');
    await cliente.query('delete from bitacoras_comunitario');
    await cliente.query('delete from control_servicios_institucionales');
    await cliente.query('delete from integrantes_grupo');
    await cliente.query('delete from grupos_proyectos');

    // 3. Resto de usuarios (el admin sobrevive porque no tiene hijos).
    await cliente.query('delete from usuarios where id_usuario <> $1', [idAdmin]);

    // 4. Periodos que no estan vigentes (configuracion_sistema conserva el suyo).
    const borradosPeriodos = await cliente.query(
      `delete from periodos_academicos
        where activo = false
          and id_periodo not in (
            select periodo_activo from configuracion_sistema where periodo_activo is not null
          )`
    );

    // configuracion_sistema y plantillas_documento se quedan tal cual.

    await cliente.query('commit');

    console.log(`  - periodos no vigentes eliminados: ${borradosPeriodos.rowCount ?? 0}`);
    console.log('  = configuracion_sistema y plantillas_documento conservadas');
  } catch (err) {
    await cliente.query('rollback');
    throw err;
  } finally {
    cliente.release();
  }

  // 5. Archivos subidos (firmas, sellos, evidencias): ya no apuntan a nadie.
  if (fs.existsSync(CARPETA_ARCHIVOS)) {
    fs.rmSync(CARPETA_ARCHIVOS, { recursive: true, force: true });
    fs.mkdirSync(CARPETA_ARCHIVOS, { recursive: true });
    console.log(`  - archivos subidos eliminados de ${CARPETA_ARCHIVOS}`);
  }

  const despues = await contar();
  console.log('Contenido tras el vaciado:');
  for (const [tabla, total] of Object.entries(despues)) {
    console.log(`  - ${tabla}: ${total} fila(s)`);
  }
  console.log('Vaciado completado.');
}

void main()
  .catch((err: unknown) => {
    console.error('Error al vaciar la base de datos:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
