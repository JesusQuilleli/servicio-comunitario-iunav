import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, tokenDe } from './helpers/app.js';
import { aplicarEsquema, asegurarBaseDePruebas, cerrarPool, sembrar, type DatosSemilla } from './helpers/db.js';

describe('humo del arnes', () => {
  let datos: DatosSemilla;

  beforeAll(async () => {
    await asegurarBaseDePruebas();
    await aplicarEsquema();
    datos = await sembrar();
  });

  afterAll(async () => {
    await cerrarPool();
  });

  it('la base de pruebas separada se creo y tiene datos', () => {
    expect(datos.admin).toMatch(/^[0-9a-f-]{36}$/);
    expect(datos.grupo).toMatch(/^[0-9a-f-]{36}$/);
    expect(datos.periodo).toBeGreaterThan(0);
  });

  it('resuelve los imports con extension .js dentro de vitest', async () => {
    const token = await tokenDe('admin');
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('monta la app y responde en /api/health', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
