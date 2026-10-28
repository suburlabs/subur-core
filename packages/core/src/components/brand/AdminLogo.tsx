/* eslint-disable @next/next/no-img-element */
import { siteConfig } from 'subur-site-config'

/** El logo del panell: la marca del client, el text «Subur» (crèdit textual, cap actiu de la marca: ni logo, ni tipografia, ni color;
 *  spec §0.5, §3.6) i el nom del client. El text és el que l'e2e copiat `branding` busca a /admin/login (E9). */
export function AdminLogo() {
  return (
    <span style={{ alignItems: 'center', display: 'inline-flex', gap: '0.5rem' }}>
      <img alt="" height={24} src={siteConfig.assets.logoMark} width={24} />
      <span style={{ fontWeight: 600 }}>Subur</span>
      <span style={{ opacity: 0.7 }}>{siteConfig.name}</span>
    </span>
  )
}
