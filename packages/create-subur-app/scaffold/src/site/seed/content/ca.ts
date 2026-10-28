import { heading, pageLink, paragraph, richText, type SeedBuild, type SeedLocaleContent, urlLink } from '@suburlabs/core/seed'

import type { MediaKey } from '../media'
import type { PageSlug } from './index'

const PHONE = '+34 600 000 000'
const EMAIL = 'hola@demo.example'

export const ca: SeedLocaleContent<PageSlug, MediaKey> = {
  form: {
    confirmationMessage: richText(paragraph('Gràcies. Hem rebut el missatge i us respondrem aviat.')),
    confirmationType: 'message',
    emails: [{ emailTo: EMAIL, message: richText(paragraph('Missatge nou de {{nom}} ({{email}}):'), paragraph('{{missatge}}')), replyTo: '{{email}}', subject: 'Missatge nou des de la web' }],
    fields: [
      { blockType: 'text', label: 'Nom', name: 'nom', required: true, width: 50 },
      { blockType: 'email', label: 'Correu', name: 'email', required: true, width: 50 },
      { blockType: 'textarea', label: 'Missatge', name: 'missatge', required: true, width: 100 },
      { blockType: 'checkbox', defaultValue: false, label: 'He llegit i accepto la política de privacitat', name: 'privacitat', required: true, width: 100 },
    ],
    submitButtonLabel: 'Envia',
    title: 'Contacte',
  },
  build: ({ formId, media, pages }): SeedBuild<PageSlug> => ({
    footer: {
      columns: [{ links: [{ link: pageLink(pages.serveis, 'Serveis') }, { link: pageLink(pages.contacte, 'Contacte') }], title: 'Reformes Exemple' }],
      legalLinks: [{ link: pageLink(pages['avis-legal'], 'Avís legal') }, { link: pageLink(pages.privacitat, 'Privacitat') }, { link: pageLink(pages.cookies, 'Galetes') }],
      tagline: 'Reformes petites i manteniment de la llar. Web de mostra.',
    },
    header: { navItems: [{ link: pageLink(pages.serveis, 'Serveis') }, { link: pageLink(pages.contacte, 'Contacte') }] },
    siteSettings: {
      address: 'Carrer Exemple 1\n00000 Vila Exemple',
      email: EMAIL,
      googleBusinessProfile: null,
      hours: 'De dilluns a divendres, de 9 h a 18 h',
      location: { addressCountry: 'ES', addressLocality: 'Vila Exemple', addressRegion: 'Exemple', areaServed: [{ name: 'Vila Exemple' }, { name: 'Poble Exemple' }], geo: { latitude: 40.0, longitude: 0.0 }, postalCode: '00000', streetAddress: 'Carrer Exemple 1' },
      phone: PHONE,
      // El WhatsApp es deriva del telèfon de la demo (regla de contingut: cap xarxa inventada).
      socials: [{ platform: 'whatsapp', url: 'https://wa.me/34600000000' }],
    },
    pages: {
      home: {
        layout: [
          {
            ariaLabel: 'Animació: quatre composicions abstractes que es transformen.',
            beats: [
              { body: 'Una web de mostra del nucli de Subur.', heading: 'Reformes petites, ben fetes', image: media.heroWorkshop, label: 'Taller' },
              { body: 'Cuines, banys i reparacions.', heading: 'Un sol equip per a tota la casa', image: media.heroKitchen, label: 'Cuina' },
              { body: 'Pressupost tancat abans de començar.', heading: 'Sense sorpreses', image: media.heroBath, label: 'Bany' },
              { body: 'I la casa neta quan marxem.', heading: 'Feina acabada', image: media.heroDone, label: 'Acabat' },
            ],
            blockType: 'scrollHero',
            primaryCta: pageLink(pages.contacte, 'Escriviu-nos'),
            secondaryCta: urlLink('tel:+34600000000', 'Truqueu-nos'),
          },
          {
            blockType: 'servicesGrid',
            heading: 'Serveis',
            items: [
              { image: media.serviceKitchen, page: pages.serveis, summary: 'Canvi de taulells, aixetes i mobles.', tagline: 'Cuines', title: 'Cuina' },
              { image: media.serviceBath, page: pages.serveis, summary: 'Plats de dutxa, mampares i rajoles.', tagline: 'Banys', title: 'Bany' },
              { image: media.serviceRepairs, page: pages.serveis, summary: 'Petites reparacions de la llar.', tagline: 'Manteniment', title: 'Reparacions' },
            ],
          },
          { blockType: 'note', text: 'Tots els serveis es poden contractar per separat.', title: 'Serveis a mida' },
          {
            blockType: 'featureList',
            columns: '4',
            heading: 'Com treballem',
            items: [
              { icon: 'clipboard-check', moment: 'before', text: 'Visitem la casa i fem un pressupost tancat.', title: 'Visita' },
              { icon: 'search-check', moment: 'ongoing', text: 'Revisem cada pas abans de continuar.', title: 'Seguiment' },
              { icon: 'house', moment: 'after', text: 'Deixem la casa neta en acabar.', title: 'Neteja' },
              { icon: 'package-search', moment: 'during', text: 'Portem el material i el recollim cada dia.', title: 'Material' },
            ],
          },
          { blockType: 'testimonials', heading: 'Què en diuen', items: [{ author: 'Marta R.', quote: 'Van venir quan van dir i ho van deixar tot net i endreçat.' }, { author: 'Jordi P.', quote: 'El pressupost tancat va ser exactament el que vam acabar pagant.' }, { author: 'Núria S.', quote: 'Ens van canviar el plat de dutxa en dos dies, sense cap sorpresa.' }] },
          { blockType: 'ctaBand', heading: 'Teniu una reforma pendent?', text: 'Expliqueu-nos-la i us direm què costa.' },
        ],
        meta: { description: 'Reformes petites i manteniment de la llar. Web de mostra del nucli de Subur.', title: 'Reformes Exemple' },
        slug: 'home',
        title: 'Inici',
      },
      serveis: {
        layout: [
          { blockType: 'pageHero', heading: 'Serveis', image: media.pageServices, lead: 'Tot el que fem, amb pressupost tancat.' },
          { blockType: 'statement', image: media.heroDone, text: 'Feina ben feta, a la primera.', variant: 'quote' },
          { blockType: 'featureList', columns: '2', items: [{ icon: 'sofa', text: 'Muntatge i reparació de mobles.', title: 'Mobles' }, { icon: 'droplets', text: 'Aixetes, desguassos i silicones.', title: 'Fontaneria' }] },
          {
            blockType: 'taskCatalog',
            groups: [
              { icon: 'sofa', tasks: [{ text: 'Muntatge de mobles' }, { text: 'Penjar quadres i prestatges' }], title: 'Mobles' },
              { icon: 'droplets', tasks: [{ text: 'Canvi d’aixetes' }, { text: 'Desembussos sense maquinària' }], title: 'Fontaneria' },
              { icon: 'door-open', tasks: [{ text: 'Ajust de portes' }, { text: 'Canvi de panys' }], title: 'Portes' },
            ],
          },
          { blockType: 'faq', heading: 'Preguntes freqüents', intro: 'El que més ens pregunten.', items: [{ answer: 'Sí, el pressupost és tancat.', question: 'El pressupost pot canviar?' }, { answer: 'Normalment en una setmana.', question: 'Quan podeu venir?' }] },
          { blockType: 'note', text: 'Assegurança de responsabilitat civil inclosa.', title: 'Assegurança' },
        ],
        meta: { description: 'Serveis de Reformes Exemple.', title: 'Serveis | Reformes Exemple' },
        slug: 'serveis',
        title: 'Serveis',
      },
      contacte: {
        layout: [
          { blockType: 'pageHero', heading: 'Parlem', image: media.pageContact, lead: 'Ompliu el formulari o truqueu-nos.' },
          { blockType: 'contact', form: formId, heading: 'Envieu-nos un missatge', text: 'De dilluns a divendres, de 9 h a 18 h.' },
        ],
        meta: { description: 'Contacte de Reformes Exemple.', title: 'Contacte | Reformes Exemple' },
        slug: 'contacte',
        title: 'Contacte',
      },
      'avis-legal': {
        layout: [{ blockType: 'pageHero', heading: 'Avís legal' }, { blockType: 'richTextSection', content: richText(paragraph('Web de mostra sense titular real.'), heading('h2', 'Contacte'), paragraph(`${EMAIL} · ${PHONE}`)) }],
        meta: { title: 'Avís legal | Reformes Exemple' },
        slug: 'avis-legal',
        title: 'Avís legal',
      },
      privacitat: {
        layout: [{ blockType: 'pageHero', heading: 'Política de privacitat' }, { blockType: 'richTextSection', content: richText(paragraph('Aquesta web de mostra no tracta dades de ningú.')) }],
        meta: { title: 'Privacitat | Reformes Exemple' },
        slug: 'privacitat',
        title: 'Privacitat',
      },
      cookies: {
        layout: [{ blockType: 'pageHero', heading: 'Política de galetes' }, { blockType: 'richTextSection', content: richText(paragraph('Només les galetes tècniques i, amb consentiment, les d’analítica.')) }],
        meta: { title: 'Galetes | Reformes Exemple' },
        slug: 'cookies',
        title: 'Galetes',
      },
    },
  }),
}
