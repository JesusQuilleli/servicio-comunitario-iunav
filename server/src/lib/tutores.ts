/**
 * Tipos de tutor y pertenencia a un grupo.
 *
 * Un proyecto tiene DOS tutores: el Academico (el profesor que guia el trabajo)
 * y el Comunitario (el de la institucion donde se presta el servicio). Los dos
 * validan horas de sus estudiantes, asi que "ser tutor de este grupo" dejo de
 * ser una comparacion con una columna y pasa a ser este predicado.
 *
 * Se centraliza aqui porque la condicion aparece en seis modelos distintos
 * (grupos, bitacoras, busqueda, dashboard, reportes y archivos): escrita a mano
 * en cada sitio, bastaria con olvidar una para que un tutor dejara de ver a sus
 * propios estudiantes, en silencio.
 */

export const TIPOS_TUTOR = ['academico', 'comunitario'] as const;

export type TipoTutor = (typeof TIPOS_TUTOR)[number];

export function esTipoTutor(valor: unknown): valor is TipoTutor {
  return typeof valor === 'string' && (TIPOS_TUTOR as readonly string[]).includes(valor);
}

export const ETIQUETA_TIPO_TUTOR: Record<TipoTutor, string> = {
  academico: 'Tutor Académico',
  comunitario: 'Tutor Comunitario',
};

/**
 * Fragmento SQL que es cierto cuando `$<param>` es alguno de los dos tutores
 * del grupo que lleva el alias `alias`.
 *
 * Se usa `or` y no `in (...)`: con `in`, un NULL en una de las dos columnas
 * hace que la expresion valga NULL en vez de false, que en un `where` acaba
 * dando el mismo resultado pero se lee peor y no aprovecha los indices por
 * columna (`idx_grupos_tutor_academico` / `idx_grupos_tutor_comunitario`).
 */
export function esTutorDelGrupo(alias: string, param: number): string {
  return `(${alias}.id_tutor_academico = $${param} or ${alias}.id_tutor_comunitario = $${param})`;
}
