import { useState } from 'react';
import { MoreHorizontal, Search, Pen, Ligature as FileSignature, Stamp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usuarios, type User } from '@/data/mockData';

const rolBadgeVariant: Record<string, 'default' | 'secondary' | 'info' | 'success'> = {
  Admin: 'default',
  Coordinador: 'secondary',
  Tutor: 'info',
  Estudiante: 'success',
};

export function UsuariosView() {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const filtered = usuarios.filter(
    (u) =>
      u.nombre.toLowerCase().includes(search.toLowerCase()) ||
      u.cedula.toLowerCase().includes(search.toLowerCase()) ||
      u.correo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h2>
          <p className="text-muted-foreground text-sm mt-1">Administrar usuarios del sistema de servicio comunitario</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, cédula o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Usuarios Registrados ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Nombre</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Cédula</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Correo</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Rol</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Estado</th>
                  <th className="text-center font-medium text-muted-foreground px-5 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-iunav-blue/10 text-iunav-blue text-xs font-bold">
                          {user.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <span className="font-medium text-foreground">{user.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{user.cedula}</td>
                    <td className="px-5 py-3 text-muted-foreground">{user.correo}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={rolBadgeVariant[user.rol] || 'outline'}>{user.rol}</Badge>
                        {user.rol === 'Tutor' && user.firmaDigital && (
                          <Badge variant="success" className="gap-1">
                            <FileSignature className="h-3 w-3" />
                            Firma Digital
                          </Badge>
                        )}
                        {(user.rol === 'Coordinador' || user.rol === 'Admin') && user.selloRegistrado && (
                          <Badge variant="success" className="gap-1">
                            <Stamp className="h-3 w-3" />
                            Sello Registrado
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={user.activo ? 'success' : 'danger'}>
                        {user.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedUser(user)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del Usuario</DialogTitle>
            <DialogDescription>Información detallada del usuario seleccionado</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-iunav-blue text-white text-lg font-bold">
                  {selectedUser.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.nombre}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.rol}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Cédula</p>
                  <p className="font-medium">{selectedUser.cedula}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Correo</p>
                  <p className="font-medium">{selectedUser.correo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <Badge variant={selectedUser.activo ? 'success' : 'danger'}>
                    {selectedUser.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                {selectedUser.firmaDigital && (
                  <div>
                    <p className="text-muted-foreground">Firma Digital</p>
                    <Badge variant="success" className="gap-1"><FileSignature className="h-3 w-3" />Registrada</Badge>
                  </div>
                )}
                {selectedUser.selloRegistrado && (
                  <div>
                    <p className="text-muted-foreground">Sello Digital</p>
                    <Badge variant="success" className="gap-1"><Stamp className="h-3 w-3" />Registrado</Badge>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="gap-1.5"><Pen className="h-3.5 w-3.5" />Editar</Button>
                <Button size="sm" variant="outline">Desactivar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
