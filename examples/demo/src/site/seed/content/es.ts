import { heading, pageLink, paragraph, richText, type SeedBuild, type SeedLocaleContent, urlLink } from '@suburlabs/core/seed'

import type { MediaKey } from '../media'
import type { PageSlug } from './index'

const PHONE = '+34 600 000 000'
const EMAIL = 'hola@demo.example'

// Mateixa estructura que ca.ts (claus, blocs i slugs); només canvien els textos.
// Els `name` dels camps del formulari són claus de dades, no text: no es tradueixen.
export const es: SeedLocaleContent<PageSlug, MediaKey> = {
  form: {
    confirmationMessage: richText(paragraph('Gracias. Hemos recibido su mensaje y le responderemos pronto.')),
    confirmationType: 'message',
    emails: [{ emailTo: EMAIL, message: richText(paragraph('Nuevo mensaje de {{nom}} ({{email}}):'), paragraph('{{missatge}}')), replyTo: '{{email}}', subject: 'Nuevo mensaje desde la web' }],
    fields: [
      { blockType: 'text', label: 'Nombre', name: 'nom', required: true, width: 50 },
      { blockType: 'email', label: 'Correo', name: 'email', required: true, width: 50 },
      { blockType: 'textarea', label: 'Mensaje', name: 'missatge', required: true, width: 100 },
      { blockType: 'checkbox', defaultValue: false, label: 'He leído y acepto la política de privacidad', name: 'privacitat', required: true, width: 100 },
    ],
    submitButtonLabel: 'Enviar',
    title: 'Contacto',
  },
  build: ({ formId, media, pages }): SeedBuild<PageSlug> => ({
    footer: {
      columns: [{ links: [{ link: pageLink(pages.serveis, 'Servicios') }, { link: pageLink(pages.contacte, 'Contacto') }], title: 'Reformes Exemple' }],
      legalLinks: [{ link: pageLink(pages['avis-legal'], 'Aviso legal') }, { link: pageLink(pages.privacitat, 'Privacidad') }, { link: pageLink(pages.cookies, 'Cookies') }],
      tagline: 'Pequeñas reformas y mantenimiento del hogar. Web de muestra.',
    },
    header: { navItems: [{ link: pageLink(pages.serveis, 'Servicios') }, { link: pageLink(pages.contacte, 'Contacto') }] },
    siteSettings: {
      address: 'Carrer Exemple 1\n00000 Vila Exemple',
      email: EMAIL,
      googleBusinessProfile: null,
      hours: 'De lunes a viernes, de 9 h a 18 h',
      location: { addressCountry: 'ES', addressLocality: 'Vila Exemple', addressRegion: 'Exemple', areaServed: [{ name: 'Vila Exemple' }, { name: 'Poble Exemple' }], geo: { latitude: 40.0, longitude: 0.0 }, postalCode: '00000', streetAddress: 'Carrer Exemple 1' },
      phone: PHONE,
      // El WhatsApp es deriva del telèfon de la demo (regla de contingut: cap xarxa inventada).
      socials: [{ platform: 'whatsapp', url: 'https://wa.me/34600000000' }],
    },
    pages: {
      home: {
        layout: [
          {
            ariaLabel: 'Animación: cuatro composiciones abstractas que se transforman.',
            beats: [
              { body: 'Una web de muestra del núcleo de Subur.', heading: 'Pequeñas reformas, bien hechas', image: media.heroWorkshop, label: 'Taller' },
              { body: 'Cocinas, baños y reparaciones.', heading: 'Un solo equipo para toda la casa', image: media.heroKitchen, label: 'Cocina' },
              { body: 'Presupuesto cerrado antes de empezar.', heading: 'Sin sorpresas', image: media.heroBath, label: 'Baño' },
              { body: 'Y la casa limpia cuando nos vamos.', heading: 'Trabajo terminado', image: media.heroDone, label: 'Terminado' },
            ],
            blockType: 'scrollHero',
            primaryCta: pageLink(pages.contacte, 'Escríbanos'),
            secondaryCta: urlLink('tel:+34600000000', 'Llámenos'),
          },
          {
            blockType: 'servicesGrid',
            heading: 'Servicios',
            items: [
              { image: media.serviceKitchen, page: pages.serveis, summary: 'Cambio de encimeras, grifos y muebles.', tagline: 'Cocinas', title: 'Cocina' },
              { image: media.serviceBath, page: pages.serveis, summary: 'Platos de ducha, mamparas y azulejos.', tagline: 'Baños', title: 'Baño' },
              { image: media.serviceRepairs, page: pages.serveis, summary: 'Pequeñas reparaciones del hogar.', tagline: 'Mantenimiento', title: 'Reparaciones' },
            ],
          },
          { blockType: 'note', text: 'Todos los servicios se pueden contratar por separado.', title: 'Servicios a medida' },
          {
            blockType: 'featureList',
            columns: '4',
            heading: 'Cómo trabajamos',
            items: [
              { icon: 'clipboard-check', moment: 'before', text: 'Visitamos la casa y hacemos un presupuesto cerrado.', title: 'Visita' },
              { icon: 'search-check', moment: 'ongoing', text: 'Revisamos cada paso antes de continuar.', title: 'Seguimiento' },
              { icon: 'house', moment: 'after', text: 'Dejamos la casa limpia al terminar.', title: 'Limpieza' },
              { icon: 'package-search', moment: 'during', text: 'Traemos el material y lo recogemos cada día.', title: 'Material' },
            ],
          },
          { blockType: 'testimonials', heading: 'Qué dicen', items: [{ author: 'Marta R.', quote: 'Vinieron cuando dijeron y lo dejaron todo limpio y ordenado.' }, { author: 'Jordi P.', quote: 'El presupuesto cerrado fue exactamente lo que acabamos pagando.' }, { author: 'Núria S.', quote: 'Nos cambiaron el plato de ducha en dos días, sin ninguna sorpresa.' }] },
          { blockType: 'ctaBand', heading: '¿Tiene una reforma pendiente?', text: 'Cuéntenosla y le diremos cuánto cuesta.' },
        ],
        meta: { description: 'Pequeñas reformas y mantenimiento del hogar. Web de muestra del núcleo de Subur.', title: 'Reformes Exemple' },
        slug: 'home',
        title: 'Inicio',
      },
      serveis: {
        layout: [
          { blockType: 'pageHero', heading: 'Servicios', image: media.pageServices, lead: 'Todo lo que hacemos, con presupuesto cerrado.' },
          { blockType: 'statement', image: media.heroDone, text: 'Trabajo bien hecho, a la primera.', variant: 'quote' },
          { blockType: 'featureList', columns: '2', items: [{ icon: 'sofa', text: 'Montaje y reparación de muebles.', title: 'Muebles' }, { icon: 'droplets', text: 'Grifos, desagües y siliconas.', title: 'Fontanería' }] },
          {
            blockType: 'taskCatalog',
            groups: [
              { icon: 'sofa', tasks: [{ text: 'Montaje de muebles' }, { text: 'Colgar cuadros y estantes' }], title: 'Muebles' },
              { icon: 'droplets', tasks: [{ text: 'Cambio de grifos' }, { text: 'Desatascos sin maquinaria' }], title: 'Fontanería' },
              { icon: 'door-open', tasks: [{ text: 'Ajuste de puertas' }, { text: 'Cambio de cerraduras' }], title: 'Puertas' },
            ],
          },
          { blockType: 'faq', heading: 'Preguntas frecuentes', intro: 'Lo que más nos preguntan.', items: [{ answer: 'Sí, el presupuesto es cerrado.', question: '¿El presupuesto puede cambiar?' }, { answer: 'Normalmente en una semana.', question: '¿Cuándo pueden venir?' }] },
          { blockType: 'note', text: 'Seguro de responsabilidad civil incluido.', title: 'Seguro' },
        ],
        meta: { description: 'Servicios de Reformes Exemple.', title: 'Servicios | Reformes Exemple' },
        slug: 'serveis',
        title: 'Servicios',
      },
      contacte: {
        layout: [
          { blockType: 'pageHero', heading: 'Hablemos', image: media.pageContact, lead: 'Rellene el formulario o llámenos.' },
          { blockType: 'contact', form: formId, heading: 'Envíenos un mensaje', text: 'De lunes a viernes, de 9 h a 18 h.' },
        ],
        meta: { description: 'Contacto de Reformes Exemple.', title: 'Contacto | Reformes Exemple' },
        slug: 'contacte',
        title: 'Contacto',
      },
      'avis-legal': {
        layout: [{ blockType: 'pageHero', heading: 'Aviso legal' }, { blockType: 'richTextSection', content: richText(paragraph('Web de muestra sin titular real.'), heading('h2', 'Contacto'), paragraph(`${EMAIL} · ${PHONE}`)) }],
        meta: { title: 'Aviso legal | Reformes Exemple' },
        slug: 'avis-legal',
        title: 'Aviso legal',
      },
      privacitat: {
        layout: [{ blockType: 'pageHero', heading: 'Política de privacidad' }, { blockType: 'richTextSection', content: richText(paragraph('Esta web de muestra no trata datos de nadie.')) }],
        meta: { title: 'Privacidad | Reformes Exemple' },
        slug: 'privacitat',
        title: 'Privacidad',
      },
      cookies: {
        layout: [{ blockType: 'pageHero', heading: 'Política de cookies' }, { blockType: 'richTextSection', content: richText(paragraph('Solo las cookies técnicas y, con consentimiento, las de analítica.')) }],
        meta: { title: 'Cookies | Reformes Exemple' },
        slug: 'cookies',
        title: 'Cookies',
      },
    },
  }),
}
