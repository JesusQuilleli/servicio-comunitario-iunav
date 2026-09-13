export type UserRole = 'Estudiante' | 'Tutor' | 'Coordinador' | 'Admin';

export interface User {
  id: string;
  nombre: string;
  cedula: string;
  correo: string;
  rol: UserRole;
  firmaDigital?: boolean;
  selloRegistrado?: boolean;
  activo: boolean;
}

export interface Proyecto {
  id: string;
  nombre: string;
  periodo: string;
  tutorId: string;
  tutorNombre: string;
  integrantes: { id: string; nombre: string; iniciales: string }[];
  estado: 'En Curso' | 'Finalizado' | 'Pendiente Aprobación' | 'Suspendido';
  proyectoEscritoSubido: boolean;
  diapositivasSubidas: boolean;
}

export type EstadoBitacora = 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Corregir';

export interface EntradaBitacora {
  id: string;
  estudianteId: string;
  estudianteNombre: string;
  semana: number;
  fecha: string;
  descripcion: string;
  horas: number;
  evidenciaFotografica: boolean;
  estado: EstadoBitacora;
  comentarioTutor?: string;
  tipo: 'comunitario' | 'social' | 'ambiental';
}

export interface ActividadReciente {
  id: string;
  descripcion: string;
  fecha: string;
  tipo: 'aprobacion' | 'registro' | 'subida' | 'inscripcion';
  usuario: string;
}

export interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  tamano: string;
}

export interface Configuracion {
  horasTotalesRequeridas: number;
  limiteHorasDiarias: number;
  periodoActual: string;
  fechaInicioPeriodo: string;
  fechaFinPeriodo: string;
}

// --- MOCK DATA ---

export const usuarios: User[] = [
  { id: 'u1', nombre: 'Carlos Mendoza', cedula: 'V-28.456.123', correo: 'cmendoza@iunav.edu.ve', rol: 'Admin', activo: true },
  { id: 'u2', nombre: 'María Fernanda López', cedula: 'V-18.234.567', correo: 'mlopez@iunav.edu.ve', rol: 'Coordinador', firmaDigital: true, selloRegistrado: true, activo: true },
  { id: 'u3', nombre: 'José Rafael Pérez', cedula: 'V-22.890.345', correo: 'jperez@iunav.edu.ve', rol: 'Tutor', firmaDigital: true, activo: true },
  { id: 'u4', nombre: 'Ana Carolina Rodríguez', cedula: 'V-25.678.901', correo: 'arodriguez@iunav.edu.ve', rol: 'Tutor', firmaDigital: false, activo: true },
  { id: 'u5', nombre: 'Luis Miguel Torres', cedula: 'V-20.123.456', correo: 'ltorres@iunav.edu.ve', rol: 'Tutor', firmaDigital: true, activo: true },
  { id: 'u6', nombre: 'Gabriela Alejandra Martínez', cedula: 'V-26.567.890', correo: 'gmartinez@iunav.edu.ve', rol: 'Estudiante', activo: true },
  { id: 'u7', nombre: 'Diego Alejandro Hernández', cedula: 'V-24.345.678', correo: 'dhernandez@iunav.edu.ve', rol: 'Estudiante', activo: true },
  { id: 'u8', nombre: 'Valentina Sofía García', cedula: 'V-27.890.123', correo: 'vgarcia@iunav.edu.ve', rol: 'Estudiante', activo: true },
  { id: 'u9', nombre: 'Santiago Emilio Sánchez', cedula: 'V-19.456.789', correo: 'ssanchez@iunav.edu.ve', rol: 'Estudiante', activo: true },
  { id: 'u10', nombre: 'Camila Andrea Jiménez', cedula: 'V-23.789.012', correo: 'cjimenez@iunav.edu.ve', rol: 'Estudiante', activo: true },
  { id: 'u11', nombre: 'Andrés David Castillo', cedula: 'V-21.012.345', correo: 'acastillo@iunav.edu.ve', rol: 'Estudiante', activo: true },
  { id: 'u12', nombre: 'Isabella María Reyes', cedula: 'V-28.345.678', correo: 'ireyes@iunav.edu.ve', rol: 'Estudiante', activo: true },
  { id: 'u13', nombre: 'Juan Pablo Morales', cedula: 'V-17.678.901', correo: 'jmorales@iunav.edu.ve', rol: 'Estudiante', activo: true },
  { id: 'u14', nombre: 'Daniela Patricia Gómez', cedula: 'V-25.901.234', correo: 'dgomez@iunav.edu.ve', rol: 'Estudiante', activo: true },
  { id: 'u15', nombre: 'Ricardo José Díaz', cedula: 'V-22.234.567', correo: 'rdiaz@iunav.edu.ve', rol: 'Estudiante', activo: true },
  { id: 'u16', nombre: 'Patricia Elena Vargas', cedula: 'V-20.567.890', correo: 'pvargas@iunav.edu.ve', rol: 'Coordinador', firmaDigital: true, selloRegistrado: true, activo: true },
  { id: 'u17', nombre: 'Fernando Antonio Rivas', cedula: 'V-24.890.123', correo: 'frivas@iunav.edu.ve', rol: 'Estudiante', activo: false },
  { id: 'u18', nombre: 'Carolina Beatriz Medina', cedula: 'V-26.123.456', correo: 'cmedina@iunav.edu.ve', rol: 'Estudiante', activo: true },
];

export const proyectos: Proyecto[] = [
  {
    id: 'p1', nombre: 'Mantenimiento de Red Comunitaria - Escuela Bolivariana La Esperanza', periodo: '2026-I',
    tutorId: 'u3', tutorNombre: 'José Rafael Pérez',
    integrantes: [
      { id: 'u6', nombre: 'Gabriela Martínez', iniciales: 'GM' },
      { id: 'u7', nombre: 'Diego Hernández', iniciales: 'DH' },
      { id: 'u8', nombre: 'Valentina García', iniciales: 'VG' },
      { id: 'u9', nombre: 'Santiago Sánchez', iniciales: 'SS' },
    ],
    estado: 'En Curso', proyectoEscritoSubido: true, diapositivasSubidas: false,
  },
  {
    id: 'p2', nombre: 'Desarrollo Web para la Fundación Niños del Mañana', periodo: '2026-I',
    tutorId: 'u4', tutorNombre: 'Ana Carolina Rodríguez',
    integrantes: [
      { id: 'u10', nombre: 'Camila Jiménez', iniciales: 'CJ' },
      { id: 'u11', nombre: 'Andrés Castillo', iniciales: 'AC' },
      { id: 'u12', nombre: 'Isabella Reyes', iniciales: 'IR' },
    ],
    estado: 'En Curso', proyectoEscritoSubido: false, diapositivasSubidas: false,
  },
  {
    id: 'p3', nombre: 'Sistema de Inventario para la Casa de Alimentación Municipal', periodo: '2026-I',
    tutorId: 'u5', tutorNombre: 'Luis Miguel Torres',
    integrantes: [
      { id: 'u13', nombre: 'Juan Pablo Morales', iniciales: 'JM' },
      { id: 'u14', nombre: 'Daniela Gómez', iniciales: 'DG' },
      { id: 'u15', nombre: 'Ricardo Díaz', iniciales: 'RD' },
      { id: 'u18', nombre: 'Carolina Medina', iniciales: 'CM' },
    ],
    estado: 'Pendiente Aprobación', proyectoEscritoSubido: true, diapositivasSubidas: true,
  },
  {
    id: 'p4', nombre: 'Soporte Técnico y Capacitación Digital - Centro de Formación Popular', periodo: '2025-II',
    tutorId: 'u3', tutorNombre: 'José Rafael Pérez',
    integrantes: [
      { id: 'u6', nombre: 'Gabriela Martínez', iniciales: 'GM' },
      { id: 'u11', nombre: 'Andrés Castillo', iniciales: 'AC' },
    ],
    estado: 'Finalizado', proyectoEscritoSubido: true, diapositivasSubidas: true,
  },
  {
    id: 'p5', nombre: 'Automatización de Biblioteca Escolar - Liceo Ezequiel Zamora', periodo: '2026-I',
    tutorId: 'u4', tutorNombre: 'Ana Carolina Rodríguez',
    integrantes: [
      { id: 'u7', nombre: 'Diego Hernández', iniciales: 'DH' },
      { id: 'u9', nombre: 'Santiago Sánchez', iniciales: 'SS' },
      { id: 'u12', nombre: 'Isabella Reyes', iniciales: 'IR' },
    ],
    estado: 'En Curso', proyectoEscritoSubido: false, diapositivasSubidas: false,
  },
  {
    id: 'p6', nombre: 'Red de Sensores IoT para Monitoreo Ambiental Comunitario', periodo: '2026-I',
    tutorId: 'u5', tutorNombre: 'Luis Miguel Torres',
    integrantes: [
      { id: 'u8', nombre: 'Valentina García', iniciales: 'VG' },
      { id: 'u10', nombre: 'Camila Jiménez', iniciales: 'CJ' },
      { id: 'u13', nombre: 'Juan Pablo Morales', iniciales: 'JM' },
      { id: 'u15', nombre: 'Ricardo Díaz', iniciales: 'RD' },
    ],
    estado: 'En Curso', proyectoEscritoSubido: true, diapositivasSubidas: false,
  },
];

export const bitacoraComunitario: EntradaBitacora[] = [
  { id: 'b1', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 1, fecha: '2026-02-10', descripcion: 'Configuración de switches y routers en la escuela. Cableado estructurado del aula de informática.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Excelente trabajo. Buen dominio de las configuraciones.', tipo: 'comunitario' },
  { id: 'b2', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 2, fecha: '2026-02-17', descripcion: 'Instalación de puntos de red y configuración de VLAN para la red de la escuela.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Muy bien organizado el esquema de VLANs.', tipo: 'comunitario' },
  { id: 'b3', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 3, fecha: '2026-02-24', descripcion: 'Mantenimiento preventivo de equipos de computación. Limpieza y actualización de software.', horas: 7, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Correcto procedimiento de mantenimiento.', tipo: 'comunitario' },
  { id: 'b4', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 4, fecha: '2026-03-03', descripcion: 'Diagnóstico de fallas en la red WiFi del plantel. Reemplazo de access points dañados.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: '', tipo: 'comunitario' },
  { id: 'b5', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 5, fecha: '2026-03-10', descripcion: 'Instalación de servidor proxy y filtro de contenido para la red escolar.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Buena implementación de seguridad.', tipo: 'comunitario' },
  { id: 'b6', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 6, fecha: '2026-03-17', descripcion: 'Capacitación a docentes sobre uso de herramientas digitales y plataforma Moodle.', horas: 6, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Muy buena disposición con los docentes.', tipo: 'comunitario' },
  { id: 'b7', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 7, fecha: '2026-03-24', descripcion: 'Configuración de respaldo automático de datos del servidor educativo.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: '', tipo: 'comunitario' },
  { id: 'b8', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 8, fecha: '2026-03-31', descripcion: 'Soporte técnico a usuarios de la comunidad educativa. Atención de tickets.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Excelente atención al usuario.', tipo: 'comunitario' },
  { id: 'b9', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 9, fecha: '2026-04-07', descripcion: 'Instalación de sistema de cámaras de seguridad IP en el plantel.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: '', tipo: 'comunitario' },
  { id: 'b10', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 10, fecha: '2026-04-14', descripcion: 'Desarrollo de página web informativa para la escuela.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Diseño profesional y funcional.', tipo: 'comunitario' },
  { id: 'b11', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 11, fecha: '2026-04-21', descripcion: 'Configuración de firewall y políticas de seguridad perimetral.', horas: 5, evidenciaFotografica: false, estado: 'Pendiente', tipo: 'comunitario' },
  { id: 'b12', estudianteId: 'u7', estudianteNombre: 'Diego Hernández', semana: 1, fecha: '2026-02-10', descripcion: 'Relevamiento de requerimientos para el sistema web de la fundación.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Buen análisis de requisitos.', tipo: 'comunitario' },
  { id: 'b13', estudianteId: 'u7', estudianteNombre: 'Diego Hernández', semana: 2, fecha: '2026-02-17', descripcion: 'Diseño de base de datos y modelo entidad-relación del sistema.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: '', tipo: 'comunitario' },
  { id: 'b14', estudianteId: 'u7', estudianteNombre: 'Diego Hernández', semana: 3, fecha: '2026-02-24', descripcion: 'Desarrollo del backend con API REST para gestión de beneficiarios.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Código limpio y bien estructurado.', tipo: 'comunitario' },
  { id: 'b15', estudianteId: 'u7', estudianteNombre: 'Diego Hernández', semana: 4, fecha: '2026-03-03', descripcion: 'Implementación de frontend con React y diseño responsivo.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: '', tipo: 'comunitario' },
  { id: 'b16', estudianteId: 'u7', estudianteNombre: 'Diego Hernández', semana: 5, fecha: '2026-03-10', descripcion: 'Integración de pasarela de donaciones y módulo de reportes.', horas: 7, evidenciaFotografica: true, estado: 'Rechazado', comentarioTutor: 'Falta documentar la integración con la pasarela. Revisar seguridad.', tipo: 'comunitario' },
  { id: 'b17', estudianteId: 'u7', estudianteNombre: 'Diego Hernández', semana: 6, fecha: '2026-03-17', descripcion: 'Corrección de vulnerabilidades XSS y CSRF en el sistema web.', horas: 8, evidenciaFotografica: true, estado: 'Corregir', comentarioTutor: 'Aún quedan puntos por corregir en la validación de inputs.', tipo: 'comunitario' },
  { id: 'b18', estudianteId: 'u7', estudianteNombre: 'Diego Hernández', semana: 7, fecha: '2026-03-24', descripcion: 'Pruebas de usuario con personal de la fundación. Recopilación de feedback.', horas: 6, evidenciaFotografica: true, estado: 'Pendiente', tipo: 'comunitario' },
  { id: 'b19', estudianteId: 'u8', estudianteNombre: 'Valentina García', semana: 1, fecha: '2026-02-10', descripcion: 'Instalación de sensores de temperatura y humedad en áreas verdes.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Buena selección de sensores.', tipo: 'comunitario' },
  { id: 'b20', estudianteId: 'u8', estudianteNombre: 'Valentina García', semana: 2, fecha: '2026-02-17', descripcion: 'Configuración de gateway LoRaWAN para transmisión de datos.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: '', tipo: 'comunitario' },
  { id: 'b21', estudianteId: 'u8', estudianteNombre: 'Valentina García', semana: 3, fecha: '2026-02-24', descripcion: 'Desarrollo de dashboard para visualización de datos ambientales en tiempo real.', horas: 8, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Excelente visualización.', tipo: 'comunitario' },
  { id: 'b22', estudianteId: 'u8', estudianteNombre: 'Valentina García', semana: 4, fecha: '2026-03-03', descripcion: 'Calibración de sensores y validación de datos con estación meteorológica.', horas: 7, evidenciaFotografica: false, estado: 'Pendiente', tipo: 'comunitario' },
];

export const bitacoraSocial: EntradaBitacora[] = [
  { id: 'bs1', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 1, fecha: '2026-02-12', descripcion: 'Taller de alfabetización digital para adultos mayores de la comunidad.', horas: 6, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Muy buena dinámica con los adultos mayores.', tipo: 'social' },
  { id: 'bs2', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 2, fecha: '2026-02-19', descripcion: 'Asistencia técnica en el comedor comunitario. Reparación de equipos.', horas: 4, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: '', tipo: 'social' },
  { id: 'bs3', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 3, fecha: '2026-02-26', descripcion: 'Capacitación en ofimática para personal administrativo del CDI.', horas: 6, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Contenido bien adaptado al nivel del personal.', tipo: 'social' },
  { id: 'bs4', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 4, fecha: '2026-03-05', descripcion: 'Apoyo en registro de datos del programa de alimentación escolar.', horas: 4, evidenciaFotografica: true, estado: 'Pendiente', tipo: 'social' },
  { id: 'bs5', estudianteId: 'u7', estudianteNombre: 'Diego Hernández', semana: 1, fecha: '2026-02-12', descripcion: 'Clases de programación básica para jóvenes de la comunidad.', horas: 6, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Excelente iniciativa.', tipo: 'social' },
  { id: 'bs6', estudianteId: 'u7', estudianteNombre: 'Diego Hernández', semana: 2, fecha: '2026-02-19', descripcion: 'Mantenimiento de computadores del centro comunal.', horas: 4, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: '', tipo: 'social' },
  { id: 'bs7', estudianteId: 'u7', estudianteNombre: 'Diego Hernández', semana: 3, fecha: '2026-02-26', descripcion: 'Diseño de afiches digitales para campaña de vacunación.', horas: 4, evidenciaFotografica: true, estado: 'Rechazado', comentarioTutor: 'No se evidencia la actividad descrita en las fotos.', tipo: 'social' },
];

export const bitacoraAmbiental: EntradaBitacora[] = [
  { id: 'ba1', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 1, fecha: '2026-02-14', descripcion: 'Jornada de recolección de residuos electrónicos en la comunidad.', horas: 6, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Buena organización del evento.', tipo: 'ambiental' },
  { id: 'ba2', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 2, fecha: '2026-02-21', descripcion: 'Taller de reciclaje y disposición adecuada de equipos obsoletos.', horas: 4, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: '', tipo: 'ambiental' },
  { id: 'ba3', estudianteId: 'u6', estudianteNombre: 'Gabriela Martínez', semana: 3, fecha: '2026-02-28', descripcion: 'Siembra de árboles nativos en áreas verdes de la escuela.', horas: 6, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Linda actividad comunitaria.', tipo: 'ambiental' },
  { id: 'ba4', estudianteId: 'u8', estudianteNombre: 'Valentina García', semana: 1, fecha: '2026-02-14', descripcion: 'Monitoreo de calidad del aire con sensores Arduino.', horas: 6, evidenciaFotografica: true, estado: 'Aprobado', comentarioTutor: 'Datos interesantes recogidos.', tipo: 'ambiental' },
  { id: 'ba5', estudianteId: 'u8', estudianteNombre: 'Valentina García', semana: 2, fecha: '2026-02-21', descripcion: 'Jornada de limpieza del río Guaire sector El Recreo.', horas: 8, evidenciaFotografica: true, estado: 'Pendiente', tipo: 'ambiental' },
  { id: 'ba6', estudianteId: 'u8', estudianteNombre: 'Valentina García', semana: 3, fecha: '2026-02-28', descripcion: 'Instalación de estación meteorológica comunitaria con energía solar.', horas: 6, evidenciaFotografica: true, estado: 'Corregir', comentarioTutor: 'Falta foto de la instalación terminada.', tipo: 'ambiental' },
];

export const actividadesRecientes: ActividadReciente[] = [
  { id: 'a1', descripcion: 'Gabriela Martínez registró 8 horas de servicio comunitario', fecha: '2026-04-21', tipo: 'registro', usuario: 'Gabriela Martínez' },
  { id: 'a2', descripcion: 'José Rafael Pérez aprobó 5 entradas de bitácora', fecha: '2026-04-20', tipo: 'aprobacion', usuario: 'José Rafael Pérez' },
  { id: 'a3', descripcion: 'Diego Hernández subió proyecto escrito del sistema web', fecha: '2026-04-19', tipo: 'subida', usuario: 'Diego Hernández' },
  { id: 'a4', descripcion: 'Valentina García se inscribió al proyecto IoT Ambiental', fecha: '2026-04-18', tipo: 'inscripcion', usuario: 'Valentina García' },
  { id: 'a5', descripcion: 'Ana Carolina Rodríguez rechazó entrada por falta de evidencia', fecha: '2026-04-17', tipo: 'aprobacion', usuario: 'Ana Carolina Rodríguez' },
  { id: 'a6', descripcion: 'Camila Jiménez registró 7 horas de servicio social', fecha: '2026-04-16', tipo: 'registro', usuario: 'Camila Jiménez' },
  { id: 'a7', descripcion: 'Luis Miguel Torres aprobó proyecto de inventario', fecha: '2026-04-15', tipo: 'aprobacion', usuario: 'Luis Miguel Torres' },
  { id: 'a8', descripcion: 'Andrés Castillo completó 100 horas comunitarias', fecha: '2026-04-14', tipo: 'registro', usuario: 'Andrés Castillo' },
];

export const plantillas: Plantilla[] = [
  { id: 'pl1', nombre: 'Planilla de Inscripción al Servicio Comunitario', descripcion: 'Formulario oficial para la inscripción de estudiantes al programa de servicio comunitario.', tipo: 'PDF', tamano: '245 KB' },
  { id: 'pl2', nombre: 'Guía Metodológica para Proyectos Comunitarios', descripcion: 'Documento con lineamientos y metodología para la formulación de proyectos de servicio comunitario.', tipo: 'PDF', tamano: '1.2 MB' },
  { id: 'pl3', nombre: 'Formato de Bitácora de Servicio Comunitario', descripcion: 'Plantilla oficial para el registro semanal de actividades del servicio comunitario.', tipo: 'DOCX', tamano: '89 KB' },
  { id: 'pl4', nombre: 'Modelo de Informe Final de Proyecto', descripcion: 'Estructura y formato para la elaboración del informe final del proyecto comunitario.', tipo: 'DOCX', tamano: '156 KB' },
  { id: 'pl5', nombre: 'Rubrica de Evaluación del Desempeño', descripcion: 'Criterios de evaluación para la calificación del servicio comunitario del estudiante.', tipo: 'PDF', tamano: '312 KB' },
  { id: 'pl6', nombre: 'Manual del Tutor - Servicio Comunitario', descripcion: 'Guía completa para tutores con procedimientos de validación y seguimiento.', tipo: 'PDF', tamano: '2.1 MB' },
  { id: 'pl7', nombre: 'Plantilla de Diapositivas para Presentación Final', descripcion: 'Formato PowerPoint con diseño institucional para la presentación del proyecto.', tipo: 'PPTX', tamano: '540 KB' },
  { id: 'pl8', nombre: 'Constancia de Cumplimiento de Servicio Comunitario', descripcion: 'Documento oficial que certifica la culminación del servicio comunitario.', tipo: 'PDF', tamano: '78 KB' },
];

export const configuracion: Configuracion = {
  horasTotalesRequeridas: 120,
  limiteHorasDiarias: 8,
  periodoActual: '2026-I',
  fechaInicioPeriodo: '2026-02-10',
  fechaFinPeriodo: '2026-07-15',
};

export const estadisticas = {
  totalEstudiantesActivos: 12,
  proyectosEnCurso: 4,
  horasValidadasMes: 187,
  totalHorasRegistradas: 1456,
  bitacorasPendientes: 8,
  tasaAprobacion: 78,
};
