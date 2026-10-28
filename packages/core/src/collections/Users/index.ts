import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated.js'
import { isSuperAdmin, isSuperAdminField, isSuperAdminOrSelf } from '../../access/roles.js'
import { adminLabel } from '../../i18n/adminLabel.js'

import {
  protectLastSuperAdminOnChange,
  protectLastSuperAdminOnDelete,
} from './hooks/protectLastSuperAdmin.js'
import { requireSuperAdminToCreate } from './hooks/requireSuperAdminToCreate.js'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: isSuperAdmin,
    delete: isSuperAdmin,
    read: isSuperAdminOrSelf,
    unlock: isSuperAdmin,
    update: isSuperAdminOrSelf,
  },
  admin: {
    defaultColumns: ['name', 'email', 'role'],
    // Comoditat, no seguretat: qui protegeix són les funcions d'`access`.
    // El client edita les seves dades des de la pàgina de compte.
    hidden: ({ user }) => user?.role !== 'superadmin',
    useAsTitle: 'name',
  },
  auth: true,
  // Tapa la ruta de «primer usuari» del motor: les rutes pròpies es registren
  // abans que les seves i el despatxador pren la primera que coincideix
  // (`dist/collections/config/sanitize.js` i `dist/utilities/handleEndpoints.js`
  // del paquet instal·lat). Qui garanteix el tancament és `requireSuperAdminToCreate`;
  // això només evita que la ruta existeixi.
  endpoints: [
    {
      handler: () => Response.json({ message: 'Not found' }, { status: 404 }),
      method: 'post',
      path: '/first-register',
    },
  ],
  labels: {
    plural: adminLabel({ ca: 'Usuaris', en: 'Users', es: 'Usuarios' }),
    singular: adminLabel({ ca: 'Usuari', en: 'User', es: 'Usuario' }),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: adminLabel({ ca: 'Nom', en: 'Name', es: 'Nombre' }),
    },
    {
      name: 'role',
      type: 'select',
      access: { create: isSuperAdminField, update: isSuperAdminField },
      defaultValue: 'admin',
      label: adminLabel({ ca: 'Rol', en: 'Role', es: 'Rol' }),
      options: [
        {
          label: adminLabel({
            ca: 'Superadministrador (Subur)',
            en: 'Superadmin (Subur)',
            es: 'Superadministrador (Subur)',
          }),
          value: 'superadmin',
        },
        {
          label: adminLabel({
            ca: 'Administrador (client)',
            en: 'Admin (client)',
            es: 'Administrador (cliente)',
          }),
          value: 'admin',
        },
      ],
      required: true,
      saveToJWT: true,
    },
  ],
  hooks: {
    beforeChange: [protectLastSuperAdminOnChange],
    beforeDelete: [protectLastSuperAdminOnDelete],
    beforeOperation: [requireSuperAdminToCreate],
  },
  timestamps: true,
}
