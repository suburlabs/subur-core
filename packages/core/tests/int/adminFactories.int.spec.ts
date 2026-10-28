// Es carrega gràcies a l'`inline` de la Task 4 (sonda S3).
import { describe, expect, it } from 'vitest'

import * as admin from '../../src/app-admin/index.js'
import config from '../fixtures/app/src/payload.config.js'

describe('fàbriques de ./app/admin', () => {
  it('exporta exactament les del grup (subur)', () => {
    expect(Object.keys(admin).sort()).toEqual(['createAdminLayout', 'createAdminNotFound', 'createAdminPage', 'createGraphqlHandlers', 'createRestHandlers'])
  })
  it('els handlers REST són els sis mètodes; GraphQL, POST i OPTIONS, més el playground', () => {
    expect(Object.keys(admin.createRestHandlers(config)).sort()).toEqual(['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT'])
    expect(Object.keys(admin.createGraphqlHandlers(config)).sort()).toEqual(['OPTIONS', 'POST', 'playground'])
  })
  it('createAdminLayout no declara cap acció: fa servir la que rep (ruling P20)', () => {
    const serverFunction = async () => null
    const Layout = admin.createAdminLayout({ config, importMap: {}, serverFunction: serverFunction as never })
    const element = Layout({ children: null }) as { props: { serverFunction: unknown } }
    expect(element.props.serverFunction).toBe(serverFunction)
  })
})
