# Prueba de carga — Sistema de Servicio Comunitario IUNAV

**Fecha de la medición:** 30/10/2026
**Motivo:** punto 1 del documento de correcciones — *«Se puede hacer una prueba
con 1000 usuarios activos, pero una prueba realista serían 60 estudiantes y 20
tutores al mismo tiempo.»*

---

## 1. Resumen

| Escenario | Peticiones | Errores | Peor p95 | Veredicto |
|---|---:|---:|---:|---|
| **60 estudiantes + 20 tutores** (realista) | 2 006 | **0 (0,00 %)** | 1,8 s | ✅ Soporta el uso previsto con holgura |
| 1 000 estudiantes + 40 tutores, pool de 10 | 11 371 | 1 416 (12,45 %) | 10,8 s | ❌ Se degrada |
| 1 000 estudiantes + 40 tutores, pool de 40 | 11 371 | 827 (7,27 %) | 13,7 s | ⚠️ Mejora, pero sigue fallando |

**Conclusión corta:** el escenario que el documento llama realista —60
estudiantes y 20 tutores trabajando a la vez— lo aguanta sin un solo error y con
todas las respuestas por debajo de los 2 segundos. Los 1 000 usuarios
simultáneos **no** los sostiene con la configuración actual: no es un problema
de la base de datos ni del número de filas, sino de que los reportes en PDF se
construyen enteros en memoria (ver §5).

---

## 2. Cómo reproducirla

```bash
cd server

# 1) Generar los datos. Escribe SIEMPRE en una base aparte (sufijo _carga),
#    nunca en la de desarrollo.
npm run db:carga                                   # 60 estudiantes, 20 tutores
npm run db:carga -- --estudiantes=1000 --tutores=40

# 2) Levantar la API apuntando a esa base, en otro puerto.
DATABASE_URL=postgresql://.../app_iunav_carga PORT=4100 npm run dev

# 3) Medir.
CARGA_API_URL=http://127.0.0.1:4100 npm run test:carga
CARGA_API_URL=http://127.0.0.1:4100 npm run test:carga -- --estudiantes=1000 --tutores=40 --vueltas=2
```

Los dos scripts (`server/scripts/datos-carga.ts` y
`server/scripts/prueba-carga.ts`) no usan ninguna dependencia nueva: solo
`fetch` y `node:perf_hooks`, que ya vienen en Node.

### Qué hace cada sesión

No todas las sesiones piden lo mismo, porque no todos los roles usan el sistema
igual:

| Rol | Recorrido por vuelta |
|---|---|
| Estudiante | `/dashboard`, `/bitacoras/mias`, `/bitacoras/metas`, `/reportes/semanas`, `/reportes/semanal.pdf` |
| Tutor | `/dashboard`, `/bitacoras/pendientes`, `/grupos`, `/busqueda` |
| Coordinación | `/dashboard`, `/usuarios`, consolidado PDF, consolidado Excel, `/historial` |

Todas arrancan **a la vez** (`Promise.allSettled`): eso es lo que significa «al
mismo tiempo» en el enunciado. Lanzarlas en fila mediría otra cosa.

### Qué se mide y por qué el p95

Se reporta el **percentil 95**, no la media. La media esconde que una de cada
veinte peticiones tarde seis segundos, y es justo esa la que hace que alguien
piense que el sistema se colgó y vuelva a pulsar el botón.

El cronómetro incluye la **lectura del cuerpo completo**, no solo las cabeceras:
un PDF no está servido hasta que llegó entero.

---

## 3. Escenario realista — 60 estudiantes + 20 tutores

Equipo: Windows 10, Node 24, PostgreSQL 17 embebido en la misma máquina.
Datos: 60 estudiantes, 20 tutores, 15 proyectos, 720 bitácoras y 240 servicios
institucionales. 5 vueltas por sesión, `DB_POOL_MAX=10` (el valor que se
entrega).

| Endpoint | n | p50 | p95 | p99 | máx | errores |
|---|---:|---:|---:|---:|---:|---:|
| `GET /reportes/consolidado.xlsx` | 5 | 1 375 ms | 1 776 ms | 1 776 ms | 1 776 ms | – |
| `GET /reportes/semanal.pdf` | 300 | 826 ms | 1 402 ms | 1 554 ms | 1 620 ms | – |
| `GET /dashboard` (estudiante) | 300 | 602 ms | 1 193 ms | 1 438 ms | 1 486 ms | – |
| `GET /dashboard` (tutor) | 100 | 146 ms | 1 084 ms | 1 229 ms | 1 262 ms | – |
| `GET /grupos` | 100 | 156 ms | 991 ms | 1 010 ms | 1 018 ms | – |
| `GET /bitacoras/pendientes` | 100 | 216 ms | 921 ms | 1 001 ms | 1 003 ms | – |
| `POST /auth/login` | 81 | 540 ms | 689 ms | 692 ms | 692 ms | – |
| `GET /reportes/consolidado.pdf` | 5 | 243 ms | 582 ms | 582 ms | 582 ms | – |
| `GET /dashboard` (gestión) | 5 | 134 ms | 553 ms | 553 ms | 553 ms | – |
| `GET /usuarios` | 5 | 111 ms | 527 ms | 527 ms | 527 ms | – |
| `GET /reportes/semanas` | 300 | 111 ms | 264 ms | 278 ms | 370 ms | – |
| `GET /busqueda` | 100 | 110 ms | 203 ms | 441 ms | 483 ms | – |
| `GET /bitacoras/mias` | 300 | 95 ms | 167 ms | 171 ms | 192 ms | – |
| `GET /bitacoras/metas` | 300 | 72 ms | 135 ms | 157 ms | 162 ms | – |
| `GET /historial` | 5 | 60 ms | 121 ms | 121 ms | 121 ms | – |

**Total: 2 006 peticiones, 0 errores, 10,4 s, 193 peticiones por segundo.**

Lectura: el caso de uso real del IUNAV cabe sin apuros. El endpoint más lento es
el consolidado en Excel, y aun así está por debajo de los 2 segundos con 80
personas trabajando a la vez.

---

## 4. Escenario de 1 000 usuarios

Datos: 1 000 estudiantes, 40 tutores, 250 proyectos, 12 000 bitácoras y 4 000
servicios institucionales. 2 vueltas por sesión.

### Con el pool por defecto (`DB_POOL_MAX=10`)

**11 371 peticiones, 1 416 errores (12,45 %), 42 s.**

Los 1 416 errores son el mismo: `timeout exceeded when trying to connect`. El
pool de PostgreSQL tiene 10 conexiones y un tope de espera de 5 segundos; con
1 041 sesiones a la vez, las peticiones hacen cola y las que esperan más de 5 s
mueren con un 500.

### Con el pool subido a 40 (`DB_POOL_MAX=40`)

| Endpoint | n | p50 | p95 | máx | errores |
|---|---:|---:|---:|---:|---:|
| `GET /reportes/semanal.pdf` | 2 000 | 9 026 ms | 13 664 ms | 14 543 ms | **726** |
| `GET /reportes/consolidado.xlsx` | 2 | 12 496 ms | 12 987 ms | 12 987 ms | 2 |
| `GET /dashboard` (estudiante) | 2 000 | 5 219 ms | 9 520 ms | 10 747 ms | 99 |
| `GET /reportes/consolidado.pdf` | 2 | 3 107 ms | 6 329 ms | 6 329 ms | – |
| `POST /auth/login` | 1 041 | 4 107 ms | 5 119 ms | 5 161 ms | – |
| `GET /bitacoras/metas` | 2 000 | 1 674 ms | 2 637 ms | 2 752 ms | – |
| `GET /reportes/semanas` | 2 000 | 1 700 ms | 2 601 ms | 2 822 ms | – |
| `GET /bitacoras/mias` | 2 000 | 1 543 ms | 2 198 ms | 6 383 ms | – |

**11 371 peticiones, 827 errores (7,27 %), 50 s.**

Subir el pool de 10 a 40 **baja los errores casi a la mitad (12,45 % → 7,27 %)
pero no los elimina**, y de hecho empeora los percentiles de los reportes: con
más consultas en paralelo, la CPU se reparte entre más generaciones de PDF
simultáneas y cada una tarda más.

Eso descarta la explicación fácil («faltan conexiones») y señala a la de verdad.

---

## 5. Dónde está el cuello de botella

**No es la base de datos.** Las consultas simples siguen respondiendo en
1-2 segundos con 12 000 bitácoras: `/bitacoras/mias`, `/bitacoras/metas` y
`/reportes/semanas` no fallan ni una vez en ninguno de los escenarios.

**Son los reportes, y la razón es que se construyen enteros en memoria.** De los
827 errores con pool 40, **728 (el 88 %) son de los dos endpoints que generan
documentos**: `semanal.pdf` y `consolidado.xlsx`. Es exactamente el riesgo que
`HANDOFF.md` ya anotaba en su sección 5.5.

El patrón actual es, en `reporte.controller.ts`:

1. se trae todo el conjunto de filas a memoria,
2. `pdfkit` (o `exceljs`) construye el documento completo en un `Buffer`,
3. `res.send(buffer)` lo entrega de una vez.

Con 300 PDFs a la vez, eso son 300 documentos vivos en el montón del proceso
compitiendo por la misma CPU. Nada se libera hasta que cada uno termina.

---

## 6. Recomendaciones

Ordenadas por lo que más rinde frente a lo que cuesta:

1. **Para el uso real del IUNAV no hace falta tocar nada.** Con 60-80 personas a
   la vez el sistema responde sin errores y por debajo de 2 s. Esta sección es
   para si algún día crece.

2. **Si se pasa de ~200 usuarios simultáneos, subir `DB_POOL_MAX`** a 25-50 en
   `server/.env`, sin superar el `max_connections` de PostgreSQL (100 por
   defecto) y contando que puede haber más de un proceso de la API. Es una línea
   y se nota.

3. **Servir los reportes como *stream*** en vez de bufferizarlos:
   `doc.pipe(res)` en lugar de `Buffer.concat` + `res.send`. Es el cambio que de
   verdad resuelve el problema, porque el documento deja de existir entero en
   memoria. Toca `server/src/lib/reportes/pdf.ts` y los cuatro controladores de
   reporte.

4. **Poner un límite de generaciones simultáneas** (una cola de 4-8 reportes a
   la vez). Es preferible que el usuario número nueve espere su turno y reciba
   su PDF, a que los nueve reciban un 500.

5. **No ejecutar la API y PostgreSQL en la misma máquina** si se llega a esos
   volúmenes: en esta medición compiten por la misma CPU, y parte de la
   degradación es eso.

---

## 7. Advertencias sobre la medición

Para que nadie saque más conclusiones de las que se pueden sacar:

- **Todo corrió en una sola máquina de escritorio**, con el generador de carga,
  la API y PostgreSQL compitiendo por la misma CPU. Un servidor real con la base
  en otra máquina dará mejores números.
- **La carga es sintética.** Las sesiones no piensan entre petición y petición:
  en cuanto llega una respuesta, piden la siguiente. Una persona real tarda
  segundos en leer la pantalla, así que 1 000 sesiones de este script aprietan
  mucho más que 1 000 personas.
- **Los datos están repartidos de forma regular** (todos los estudiantes con el
  mismo número de registros). Un caso real tendrá unos pocos estudiantes con
  muchísimos registros, que es un perfil distinto.
- La prueba **no mide escritura concurrente** (altas, validaciones): es de
  lectura, que es lo que domina el uso diario.
