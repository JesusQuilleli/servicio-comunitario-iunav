import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import * as model from '../models/dashboard.model.js';
import { ApiError } from '../lib/errors.js';

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export async function getDashboard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rol = req.usuario?.rol;
    const id = req.usuario?.idUsuario;
    if (!rol || !id) {
      throw new ApiError(401, 'No autenticado');
    }

    if (rol === 'estudiante') {
      const [config, horas, proyecto, pendientes, aprobadas] = await Promise.all([
        model.obtenerConfiguracion(),
        model.obtenerHorasEstudiante(id),
        model.obtenerProyectoEstudiante(id),
        model.obtenerEntradasEstudiante(id, 'pendientes'),
        model.obtenerEntradasEstudiante(id, 'aprobadas'),
      ]);

      const pctDirecto = Math.min(100, Math.round((horas.horasDirectas / config.horasDirectas) * 100));
      const pctImpacto = Math.min(100, Math.round((horas.horasImpacto / config.horasImpacto) * 100));

      res.json({
        rol,
        horasDirectas: horas.horasDirectas,
        horasImpacto: horas.horasImpacto,
        totalHoras: horas.horasDirectas + horas.horasImpacto,
        metas: { directas: config.horasDirectas, impacto: config.horasImpacto },
        pctDirecto,
        pctImpacto,
        pendientesCount: horas.pendientes,
        proyecto: proyecto
          ? {
              nombreProyecto: proyecto.nombreProyecto,
              periodo: proyecto.periodo,
              tutorNombre: proyecto.tutorNombre,
              estado: proyecto.estado,
              proyectoEscrito: proyecto.proyectoEscrito,
              diapositivas: proyecto.diapositivas,
              integrantes: proyecto.integrantes.map((i) => ({
                id: i.id,
                nombre: i.nombre,
                iniciales: iniciales(i.nombre),
              })),
            }
          : null,
        pendientes: pendientes.map((p) => ({
          id: p.id,
          tipo: p.tipo,
          semana: p.semana,
          fecha: p.fecha,
          descripcion: p.descripcion,
          horas: p.horas,
          estado: p.estado,
        })),
        aprobadasRecientes: aprobadas.map((a) => ({
          id: a.id,
          tipo: a.tipo,
          semana: a.semana,
          fecha: a.fecha,
          descripcion: a.descripcion,
          horas: a.horas,
          evidencia: a.evidencia,
        })),
      });
      return;
    }

    if (rol === 'tutor') {
      const [resumen, proyectos, integrantes, pendientes] = await Promise.all([
        model.obtenerResumenTutor(id),
        model.obtenerProyectosTutor(id),
        model.obtenerIntegrantesPorGrupo(id),
        model.obtenerPendientesTutor(id),
      ]);

      res.json({
        rol,
        resumen,
        proyectos: proyectos.map((p) => ({
          id: p.idGrupo,
          nombre: p.nombreProyecto,
          periodo: p.periodo,
          estado: p.estado,
          integrantes: (integrantes.get(p.idGrupo) ?? []).map((i) => ({
            id: i.id,
            nombre: i.nombre,
            iniciales: iniciales(i.nombre),
          })),
        })),
        pendientes: pendientes.map((p) => ({
          id: p.id,
          estudianteNombre: p.estudianteNombre,
          tipo: p.tipo,
          semana: p.semana,
          fecha: p.fecha,
          descripcion: p.descripcion,
          horas: p.horas,
          estado: p.estado,
        })),
      });
      return;
    }

    const [config, resumen, proyectosPendientes, tutores, actividad] = await Promise.all([
      model.obtenerConfiguracion(),
      model.obtenerResumenGestion(),
      model.obtenerProyectosPendientes(),
      model.obtenerTutores(),
      model.obtenerActividadReciente(),
    ]);

    res.json({
      rol,
      resumen,
      horas: {
        directas: resumen.horasDirectas,
        impacto: resumen.horasImpacto,
        totalRegistradas: resumen.totalRegistradas,
        metaDirectas: config.horasDirectas,
        metaImpacto: config.horasImpacto,
      },
      proyectosPendientes,
      tutores,
      actividad,
    });
  } catch (err) {
    next(err);
  }
}