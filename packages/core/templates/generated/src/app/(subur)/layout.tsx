import config from '@payload-config'
import '@payloadcms/next/css'
import { handleServerFunctions } from '@payloadcms/next/layouts'
import { createAdminLayout } from '@suburlabs/core/app/admin'
import type { ServerFunctionClient } from 'payload'

import { importMap } from './admin/importMap.js'
import './custom.scss'

// L'acció de servidor, a nivell de mòdul: només captura imports. Declarada dins de la fàbrica capturaria
// `config` i `importMap`, que no es poden serialitzar.
const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({ ...args, config, importMap })
}

export default createAdminLayout({ config, importMap, serverFunction })
