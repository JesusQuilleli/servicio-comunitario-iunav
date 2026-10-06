import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';

export type TipoPlantilla = 'bitacora' | 'acta' | 'informe' | 'certificado';

export interface ConfiguracionSistema {
  horasDirectas: number;
  horasImpacto: number;
  limiteHorasDiarias: number;
  periodoActivoId: number | null;
  periodoActivoNombre: string | null;
  actualizadoEn: string;
}

export interface DatosConfiguracion {
  horasDirectas: number;
  horasImpacto: number;
  limiteHorasDiarias: number;
  periodoActivoId: number | null;
}

export interface FilaPlantilla {
  idPlantilla: number;
  nombre: string;
  descripcion: string | null;
  tipo: TipoPlantilla;
  urlDocumento: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface DatosPlantilla {
  nombre: string;
  descripcion: string | null;
  tipo: TipoPlantilla;
}

interface FilaConfiguracion {
  horas_directas: number;
  horas_impacto: number;
  limite_horas_diarias: number;
  periodo_activo: number | null;
  periodo_activo_nombre: string | null;
  actualizado_en: string;
}

const SELECCION_CONFIGURACION = `
  select c.horas_directas,
         c.horas_impacto,
         c.limite_horas_diarias,
         c.periodo_activo,
         p.nombre_periodo as periodo_activo_nombre,
         c.actualizado_en
  from configuracion_sistema c
  left join periodos_academicos p on p.id_periodo = c.periodo_activo
`;

function mapearConfiguracion(r: FilaConfiguracion): ConfiguracionSistema {
  return {
    horasDirectas: r.horas_directas,
    horasImpacto: r.horas_impacto,
    limiteHorasDiarias: r.limite_horas_diarias,
    periodoActivoId: r.periodo_activo,
    periodoActivoNombre: r.periodo_activo_nombre,
    actualizadoEn: r.actualizado_en,
  };
}

const VALORES_POR_DEFECTO: DatosConfiguracion = {
  horasDirectas: 90,
  horasImpacto: 30,
  limiteHorasDiarias: 8,
  periodoActivoId: null,
};

/** Devuelve la configuración del programa; si la tabla está vacía, devuelve los valores por defecto. */
export async function obtenerConfiguracion(): Promise<ConfiguracionSistema> {
  const { rows } = await pool.query<FilaConfiguracion>(`${SELECCION_CONFIGURACION} limit 1`, []);

  if (rows.length === 0) {
    return { ...VALORES_POR_DEFECTO, periodoActivoNombre: null, actualizadoEn: new Date(0).toISOString() };
  }

  return mapearConfiguracion(rows[0]);
}

/** Actualiza la fila única de configuracion_sistema; la inserta si aún no existe. */
export async function actualizarConfiguracion(datos: DatosConfiguracion): Promise<ConfiguracionSistema> {
  if (datos.periodoActivoId !== null) {
    const { rows } = await pool.query<{ id_periodo: number }>(
      'select id_periodo from periodos_academicos where id_periodo = $1',
      [datos.periodoActivoId]
    );
    if (rows.length === 0) {
      throw new ApiError(404, 'El período académico seleccionado no existe');
    }
  }

  const { rows: actualizadas } = await pool.query(
    `update configuracion_sistema
     set horas_directas = $1,
         horas_impacto = $2,
         limite_horas_diarias = $3,
         periodo_activo = $4,
         actualizado_en = now()
     returning id_config`,
    [datos.horasDirectas, datos.horasImpacto, datos.limiteHorasDiarias, datos.periodoActivoId]
  );

  if (actualizadas.length === 0) {
    await pool.query(
      `insert into configuracion_sistema (horas_directas, horas_impacto, limite_horas_diarias, periodo_activo)
       values ($1, $2, $3, $4)`,
      [datos.horasDirectas, datos.horasImpacto, datos.limiteHorasDiarias, datos.periodoActivoId]
    );
  }

  return obtenerConfiguracion();
}

interface FilaPlantillaCruda {
  id_plantilla: number;
  nombre: string;
  descripcion: string | null;
  tipo: TipoPlantilla;
  url_documento: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
}

function mapearPlantilla(r: FilaPlantillaCruda): FilaPlantilla {
  return {
    idPlantilla: r.id_plantilla,
    nombre: r.nombre,
    descripcion: r.descripcion,
    tipo: r.tipo,
    urlDocumento: r.url_documento,
    activo: r.activo,
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
  };
}

export async function listarPlantillas(soloActivas: boolean): Promise<FilaPlantilla[]> {
  const { rows } = await pool.query<FilaPlantillaCruda>(
    `select id_plantilla, nombre, descripcion, tipo, url_documento, activo, creado_en, actualizado_en
     from plantillas_documento
     ${soloActivas ? 'where activo' : ''}
     order by activo desc, tipo, nombre`,
    []
  );
  return rows.map(mapearPlantilla);
}

export async function obtenerPlantilla(id: number): Promise<FilaPlantilla> {
  const { rows } = await pool.query<FilaPlantillaCruda>(
    `select id_plantilla, nombre, descripcion, tipo, url_documento, activo, creado_en, actualizado_en
     from plantillas_documento
     where id_plantilla = $1`,
    [id]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Plantilla no encontrada');
  }
  return mapearPlantilla(rows[0]);
}

export async function crearPlantilla(datos: DatosPlantilla): Promise<FilaPlantilla> {
  const { rows: existentes } = await pool.query<{ id_plantilla: number }>(
    'select id_plantilla from plantillas_documento where lower(nombre) = lower($1)',
    [datos.nombre]
  );
  if (existentes.length > 0) {
    throw new ApiError(409, 'Ya existe una plantilla con ese nombre');
  }

  const { rows } = await pool.query<{ id_plantilla: number }>(
    // `url_documento` no se escribe aqui: la deja nula hasta que se suba el
    // archivo por `POST /plantillas/:id/documento`.
    `insert into plantillas_documento (nombre, descripcion, tipo)
     values ($1, $2, $3)
     returning id_plantilla`,
    [datos.nombre, datos.descripcion, datos.tipo]
  );

  return obtenerPlantilla(rows[0].id_plantilla);
}

export async function actualizarPlantilla(id: number, datos: DatosPlantilla): Promise<FilaPlantilla> {
  const { rows: existentes } = await pool.query<{ id_plantilla: number }>(
    'select id_plantilla from plantillas_documento where lower(nombre) = lower($1) and id_plantilla <> $2',
    [datos.nombre, id]
  );
  if (existentes.length > 0) {
    throw new ApiError(409, 'Ya existe otra plantilla con ese nombre');
  }

  const { rows } = await pool.query(
    // Igual que en el alta: renombrar una plantilla no puede deshacer la subida
    // de su documento.
    `update plantillas_documento
     set nombre = $1, descripcion = $2, tipo = $3, actualizado_en = now()
     where id_plantilla = $4
     returning id_plantilla`,
    [datos.nombre, datos.descripcion, datos.tipo, id]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Plantilla no encontrada');
  }

  return obtenerPlantilla(id);
}

export async function cambiarActivoPlantilla(id: number, activo: boolean): Promise<FilaPlantilla> {
  const { rows } = await pool.query(
    `update plantillas_documento
     set activo = $1, actualizado_en = now()
     where id_plantilla = $2
     returning id_plantilla`,
    [activo, id]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Plantilla no encontrada');
  }

  return obtenerPlantilla(id);
}
