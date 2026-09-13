import { useState } from 'react';
import { UserPlus, Search, Ligature as FileSignature, Stamp, Trash2, Pen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { usuarios, type UserRole, type User } from '@/data/mockData';

const rolBadgeVariant: Record<UserRole, 'default' | 'secondary' | 'info' | 'success'> = {
  Admin: 'default',
  Coordinador: 'secondary',
  Tutor: 'info',
  Estudiante: 'success',
};

export function RegistroUsuariosView() {
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    nombre: '',
    cedula: '',
    correo: '',
    rol: 'Estudiante' as UserRole,
    firmaDigital: false,
    selloRegistrado: false,
  });

  const filtered = usuarios.filter(
    (u) =>
      u.nombre.toLowerCase().includes(search.toLowerCase()) ||
      u.cedula.toLowerCase().includes(search.toLowerCase()) ||
      u.correo.toLowerCase().includes(search.toLowerCase())
  );

  const handleRegister = () => {
    setShowRegister(false);
    setFormData({ nombre: '', cedula: '', correo: '', rol: 'Estudiante', firmaDigital: false, selloRegistrado: false });
  };

  const roleStats = {
    Estudiante: usuarios.filter(u => u.rol === 'Estudiante').length,
    Tutor: usuarios.filter(u => u.rol === 'Tutor').length,
    Coordinador: usuarios.filter(u => u.rol === 'Coordinador').length,
    Admin: usuarios.filter(u => u.rol === 'Admin').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Registro de Usuarios</h2>
          <p className="text-muted-foreground text-sm mt-1">Administra y registra los usuarios que consumen la aplicación</p>
        </div>
        <Button className="gap-2" onClick={() => setShowRegister(true)}>
          <UserPlus className="h-4 w-4" />
          Registrar Nuevo Usuario
        </Button>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(['Estudiante', 'Tutor', 'Coordinador', 'Admin'] as UserRole[]).map(rol => (
          <Card key={rol} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                rol === 'Estudiante' ? 'bg-emerald-50' :
                rol === 'Tutor' ? 'bg-blue-50' :
                rol === 'Coordinador' ? 'bg-red-50' : 'bg-gray-100'
              }`}>
                <Badge variant={rolBadgeVariant[rol]} className="text-[10px]">{rol}</Badge>
              </div>
              <div>
                <p className="text-2xl font-bold">{roleStats[rol]}</p>
                <p className="text-xs text-muted-foreground">registrados</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, cédula o correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Users Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Usuarios del Sistema ({filtered.length})</CardTitle>
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
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Credenciales</th>
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
                      <Badge variant={rolBadgeVariant[user.rol]}>{user.rol}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.rol === 'Tutor' && (
                          user.firmaDigital ? (
                            <Badge variant="success" className="gap-0.5 text-[10px]"><FileSignature className="h-2.5 w-2.5" />Firma</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Sin firma</Badge>
                          )
                        )}
                        {(user.rol === 'Coordinador' || user.rol === 'Admin') && (
                          user.selloRegistrado ? (
                            <Badge variant="success" className="gap-0.5 text-[10px]"><Stamp className="h-2.5 w-2.5" />Sello</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Sin sello</Badge>
                          )
                        )}
                        {user.rol === 'Estudiante' && (
                          <span className="text-[10px] text-muted-foreground">--</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={user.activo ? 'success' : 'danger'}>
                        {user.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedUser(user)} title="Editar">
                          <Pen className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600" title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Register User Dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Usuario</DialogTitle>
            <DialogDescription>Completa los datos para registrar un nuevo usuario en el sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Nombre Completo</label>
              <Input
                placeholder="Ej: María García López"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cédula de Identidad</label>
              <Input
                placeholder="Ej: V-25.123.456"
                value={formData.cedula}
                onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Correo Electrónico</label>
              <Input
                type="email"
                placeholder="usuario@iunav.edu.ve"
                value={formData.correo}
                onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Rol</label>
              <select
                value={formData.rol}
                onChange={(e) => setFormData({ ...formData, rol: e.target.value as UserRole, firmaDigital: false, selloRegistrado: false })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5"
              >
                <option value="Estudiante">Estudiante</option>
                <option value="Tutor">Tutor</option>
                <option value="Coordinador">Coordinador</option>
                <option value="Admin">Administrador</option>
              </select>
            </div>
            {formData.rol === 'Tutor' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="firmaDigital"
                  checked={formData.firmaDigital}
                  onChange={(e) => setFormData({ ...formData, firmaDigital: e.target.checked })}
                  className="rounded border-input"
                />
                <label htmlFor="firmaDigital" className="text-sm">Registrar Firma Digital</label>
              </div>
            )}
            {(formData.rol === 'Coordinador' || formData.rol === 'Admin') && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="selloRegistrado"
                  checked={formData.selloRegistrado}
                  onChange={(e) => setFormData({ ...formData, selloRegistrado: e.target.checked })}
                  className="rounded border-input"
                />
                <label htmlFor="selloRegistrado" className="text-sm">Registrar Sello Digital</label>
              </div>
            )}
            <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground">
              <p>Se generará automáticamente una contraseña temporal que el usuario deberá cambiar en su primer inicio de sesión.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegister(false)}>Cancelar</Button>
            <Button onClick={handleRegister} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Registrar Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>Modifica los datos del usuario seleccionado</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-iunav-blue text-white text-lg font-bold">
                  {selectedUser.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.nombre}</h3>
                  <Badge variant={rolBadgeVariant[selectedUser.rol]}>{selectedUser.rol}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="text-sm font-medium">Cédula</label>
                  <Input defaultValue={selectedUser.cedula} className="mt-1.5" />
                </div>
                <div>
                  <label className="text-sm font-medium">Correo</label>
                  <Input defaultValue={selectedUser.correo} className="mt-1.5" />
                </div>
                <div>
                  <label className="text-sm font-medium">Rol</label>
                  <select defaultValue={selectedUser.rol} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5">
                    <option value="Estudiante">Estudiante</option>
                    <option value="Tutor">Tutor</option>
                    <option value="Coordinador">Coordinador</option>
                    <option value="Admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Estado</label>
                  <select defaultValue={selectedUser.activo ? 'activo' : 'inactivo'} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5">
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>
              {selectedUser.rol === 'Tutor' && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked={selectedUser.firmaDigital} className="rounded border-input" />
                  <label className="text-sm">Firma Digital Registrada</label>
                </div>
              )}
              {(selectedUser.rol === 'Coordinador' || selectedUser.rol === 'Admin') && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked={selectedUser.selloRegistrado} className="rounded border-input" />
                  <label className="text-sm">Sello Digital Registrado</label>
                </div>
              )}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <p>Al cambiar el rol de un usuario, se modificarán sus permisos de acceso al sistema.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancelar</Button>
            <Button onClick={() => setSelectedUser(null)}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
