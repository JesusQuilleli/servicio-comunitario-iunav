/**
 * Prueba de carga contra la API.
 *
 * El escenario que pidió la revisión: **60 estudiantes y 20 tutores a la vez**.
 * Cada sesión hace login y luego repite el recorrido típico de su rol, que no
 * es el mismo: el estudiante consulta y registra, el tutor revisa pendientes.
 *
 *   npm run db:carga      primero, para tener datos
 *   npm run test:carga    después, con la API levantada contra esa base
 *
 * Sin dependencias nuevas: `fetch` y `performance` ya vienen en Node.
 *
 * Lo que se mide es el **percentil 95**, no la media. La media esconde que una
 * de cada veinte peticiones tarde seis segundos, y es justo esa la que hace que
 * alguien piense que el sistema se colgó.
 */
import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { PASSWORD_CARGA } from './carga-comun.js';

const API = process.env.CARGA_API_URL ?? 'http://127.0.0.1:4000';

function argumento(nombre: string, porDefecto: number): number {
  const crudo = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  if (!crudo) return porDefecto;
  const valor = Number(crudo.split('=')[1]);
  if (!Number.isFinite(valor) || valor < 1) {
    throw new Error(`--${nombre} debe ser un número positivo`);
  }
  return valor;
}

const estudiantes = argumento('estudiantes', 60);
const tutores = argumento('tutores', 20);
const vueltas = argumento('vueltas', 5);

interface Medicion {
  etiqueta: string;
  ms: number;
  ok: boolean;
  /** 0 cuando la peticion ni siquiera llego a tener respuesta. */
  status: number;
  /** Solo en los fallos de red: el mensaje del error. */
  motivo?: string;
}

const mediciones: Medicion[] = [];

interface Respuesta {
  ok: boolean;
  status: number;
  /** Cuerpo ya leído: ver el comentario de abajo. */
  cuerpo: Uint8Array;
}

async function medir(
  etiqueta: string,
  token: string | null,
  ruta: string,
  opciones: RequestInit = {}
): Promise<Respuesta> {
  const comenzo = performance.now();

  let res: Response;
  try {
    res = await fetch(`${API}${ruta}`, {
      ...opciones,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
        ...opciones.headers,
      },
    });
  } catch (err) {
    // Bajo carga alta la conexion se puede cortar antes de que llegue la
    // respuesta (ECONNRESET, puertos efimeros agotados). Eso ES un resultado de
    // la prueba, no un fallo de la prueba: se anota como error y se sigue, en
    // vez de tumbar la medicion entera cuando ya iba por la mitad.
    mediciones.push({
      etiqueta,
      ms: performance.now() - comenzo,
      ok: false,
      status: 0,
      motivo: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 0, cuerpo: new Uint8Array() };
  }
  // El cuerpo se lee SIEMPRE, y dentro de la medición. Dos motivos: una
  // respuesta sin consumir retiene la conexión, y a partir de cierta
  // concurrencia las peticiones se encolarían solas (que es justo lo que se
  // está tratando de medir); y un PDF no está realmente "servido" hasta que
  // llegó entero, así que cronometrar solo las cabeceras mentiría.
  let cuerpo: Uint8Array;
  try {
    cuerpo = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    mediciones.push({
      etiqueta,
      ms: performance.now() - comenzo,
      ok: false,
      status: res.status,
      motivo: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: res.status, cuerpo: new Uint8Array() };
  }

  mediciones.push({
    etiqueta,
    ms: performance.now() - comenzo,
    ok: res.ok,
    status: res.status,
  });
  return { ok: res.ok, status: res.status, cuerpo };
}

async function login(email: string): Promise<string | null> {
  const res = await medir('POST /auth/login', null, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASSWORD_CARGA }),
  });
  if (!res.ok) return null;
  const datos = JSON.parse(new TextDecoder().decode(res.cuerpo)) as { token?: string };
  return datos.token ?? null;
}

/** Recorrido de un estudiante: mira su avance y consulta sus registros. */
async function sesionEstudiante(n: number): Promise<void> {
  const token = await login(`estudiante${n}@carga.local`);
  if (!token) return;

  for (let i = 0; i < vueltas; i += 1) {
    await medir('GET /dashboard (estudiante)', token, '/api/dashboard');
    await medir('GET /bitacoras/mias', token, '/api/bitacoras/mias?porPagina=20');
    await medir('GET /bitacoras/metas', token, '/api/bitacoras/metas');
    await medir('GET /reportes/semanas', token, '/api/reportes/semanas');
    // El reporte semanal se construye entero en memoria: es el candidato número
    // uno a convertirse en el cuello de botella.
    await medir('GET /reportes/semanal.pdf', token, '/api/reportes/semanal.pdf');
  }
}

/** Recorrido de un tutor: su bandeja de pendientes y sus grupos. */
async function sesionTutor(prefijo: string, n: number): Promise<void> {
  const token = await login(`${prefijo}${n}@carga.local`);
  if (!token) return;

  for (let i = 0; i < vueltas; i += 1) {
    await medir('GET /dashboard (tutor)', token, '/api/dashboard');
    await medir('GET /bitacoras/pendientes', token, '/api/bitacoras/pendientes?porPagina=20');
    await medir('GET /grupos', token, '/api/grupos?porPagina=20');
    await medir('GET /busqueda', token, '/api/busqueda?q=estudiante');
  }
}

/** Recorrido de la coordinación: los reportes pesados. */
async function sesionCoordinacion(): Promise<void> {
  const token = await login('coordcarga1@carga.local');
  if (!token) return;

  for (let i = 0; i < vueltas; i += 1) {
    await medir('GET /dashboard (gestión)', token, '/api/dashboard');
    await medir('GET /usuarios', token, '/api/usuarios?porPagina=20');
    await medir('GET /reportes/consolidado.pdf', token, '/api/reportes/consolidado-horas.pdf');
    await medir('GET /reportes/consolidado.xlsx', token, '/api/reportes/consolidado-horas.xlsx');
    await medir('GET /historial', token, '/api/historial?porPagina=20');
  }
}

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[indice];
}

function informe(): void {
  const porEtiqueta = new Map<string, Medicion[]>();
  for (const m of mediciones) {
    const actual = porEtiqueta.get(m.etiqueta) ?? [];
    actual.push(m);
    porEtiqueta.set(m.etiqueta, actual);
  }

  const filas = [...porEtiqueta.entries()]
    .map(([etiqueta, ms]) => {
      const tiempos = ms.map((m) => m.ms);
      const errores = ms.filter((m) => !m.ok);
      return {
        etiqueta,
        n: ms.length,
        p50: percentil(tiempos, 50),
        p95: percentil(tiempos, 95),
        p99: percentil(tiempos, 99),
        max: Math.max(...tiempos),
        errores: errores.length,
        status: [...new Set(errores.map((e) => (e.status === 0 ? 'red' : String(e.status))))].join(
          ', '
        ),
      };
    })
    .sort((a, b) => b.p95 - a.p95);

  const ancho = Math.max(...filas.map((f) => f.etiqueta.length), 30);
  console.log('');
  console.log(
    `${'Endpoint'.padEnd(ancho)}  ${'n'.padStart(5)}  ${'p50'.padStart(8)}  ${'p95'.padStart(8)}  ${'p99'.padStart(8)}  ${'max'.padStart(8)}  errores`
  );
  console.log('-'.repeat(ancho + 60));
  for (const f of filas) {
    console.log(
      `${f.etiqueta.padEnd(ancho)}  ${String(f.n).padStart(5)}  ` +
        `${f.p50.toFixed(0).padStart(7)}ms  ${f.p95.toFixed(0).padStart(7)}ms  ` +
        `${f.p99.toFixed(0).padStart(7)}ms  ${f.max.toFixed(0).padStart(7)}ms  ` +
        `${f.errores > 0 ? `${f.errores} (${f.status})` : '-'}`
    );
  }

  const total = mediciones.length;
  const fallidas = mediciones.filter((m) => !m.ok).length;
  console.log('-'.repeat(ancho + 60));
  console.log(
    `Total: ${total} peticiones, ${fallidas} con error ` +
      `(${((fallidas / total) * 100).toFixed(2)} %).`
  );

  const motivos = new Map<string, number>();
  for (const m of mediciones) {
    if (m.motivo) motivos.set(m.motivo, (motivos.get(m.motivo) ?? 0) + 1);
  }
  for (const [motivo, n] of motivos) {
    console.log(`  ${n} x ${motivo}`);
  }
}

async function main(): Promise<void> {
  console.log(`API:   ${API}`);
  console.log(`Carga: ${estudiantes} estudiantes + ${tutores} tutores, ${vueltas} vueltas cada uno.`);

  const salud = await fetch(`${API}/api/health`).catch(() => null);
  if (!salud?.ok) {
    throw new Error(
      `La API no responde en ${API}. Levántala con "npm run dev" apuntando a la base de carga.`
    );
  }

  const comenzo = performance.now();

  // Todas las sesiones arrancan a la vez: eso es lo que significa "al mismo
  // tiempo" en el enunciado. Lanzarlas en serie mediría otra cosa.
  // Los dos repartos se calculan FUERA de la condicion del bucle. Escritos
  // como `i <= Math.floor(tutores / 2) || 1`, el `<=` liga mas fuerte que el
  // `||` y la condicion queda `(i <= n) || 1`, que es siempre cierta: un bucle
  // infinito acumulando promesas hasta agotar la memoria.
  const academicos = Math.max(1, Math.ceil(tutores / 2));
  const comunitarios = Math.max(1, Math.floor(tutores / 2));

  const sesiones: Promise<void>[] = [];
  for (let i = 1; i <= estudiantes; i += 1) sesiones.push(sesionEstudiante(i));
  for (let i = 1; i <= academicos; i += 1) sesiones.push(sesionTutor('tutoracad', i));
  for (let i = 1; i <= comunitarios; i += 1) sesiones.push(sesionTutor('tutorcomun', i));
  sesiones.push(sesionCoordinacion());

  // `allSettled` y no `all`: si una sesion revienta, las demas tienen que
  // terminar igual. Si no, un unico fallo dejaria la medicion a medias y sin
  // informe, que es justo cuando mas falta hace.
  const resultados = await Promise.allSettled(sesiones);
  const rotas = resultados.filter((r) => r.status === 'rejected');

  const segundos = (performance.now() - comenzo) / 1000;
  informe();
  if (rotas.length > 0) {
    console.log(`Sesiones interrumpidas: ${rotas.length} de ${sesiones.length}.`);
  }
  console.log(
    `Duración: ${segundos.toFixed(1)} s · ` +
      `${(mediciones.length / segundos).toFixed(1)} peticiones por segundo.`
  );
}

await main();
