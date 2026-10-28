import { heading, pageLink, paragraph, richText, type SeedBuild, type SeedLocaleContent, urlLink } from '@suburlabs/core/seed'

import type { MediaKey } from '../media'
import type { PageSlug } from './index'

const PHONE = '+34 600 000 000'
const EMAIL = 'hola@demo.example'

// Mateixa estructura que ca.ts (claus, blocs i slugs); només canvien els textos.
// Els `name` dels camps del formulari són claus de dades, no text: no es tradueixen.
export const en: SeedLocaleContent<PageSlug, MediaKey> = {
  form: {
    confirmationMessage: richText(paragraph('Thank you. We have received your message and will reply soon.')),
    confirmationType: 'message',
    emails: [{ emailTo: EMAIL, message: richText(paragraph('New message from {{nom}} ({{email}}):'), paragraph('{{missatge}}')), replyTo: '{{email}}', subject: 'New message from the website' }],
    fields: [
      { blockType: 'text', label: 'Name', name: 'nom', required: true, width: 50 },
      { blockType: 'email', label: 'Email', name: 'email', required: true, width: 50 },
      { blockType: 'textarea', label: 'Message', name: 'missatge', required: true, width: 100 },
      { blockType: 'checkbox', defaultValue: false, label: 'I have read and accept the privacy policy', name: 'privacitat', required: true, width: 100 },
    ],
    submitButtonLabel: 'Send',
    title: 'Contact',
  },
  build: ({ formId, media, pages }): SeedBuild<PageSlug> => ({
    footer: {
      columns: [{ links: [{ link: pageLink(pages.serveis, 'Services') }, { link: pageLink(pages.contacte, 'Contact') }], title: 'Reformes Exemple' }],
      legalLinks: [{ link: pageLink(pages['avis-legal'], 'Legal notice') }, { link: pageLink(pages.privacitat, 'Privacy') }, { link: pageLink(pages.cookies, 'Cookies') }],
      tagline: 'Small renovations and home maintenance. A sample website.',
    },
    header: { navItems: [{ link: pageLink(pages.serveis, 'Services') }, { link: pageLink(pages.contacte, 'Contact') }] },
    siteSettings: {
      address: 'Carrer Exemple 1\n00000 Vila Exemple',
      email: EMAIL,
      googleBusinessProfile: null,
      hours: 'Monday to Friday, 9 am to 6 pm',
      location: { addressCountry: 'ES', addressLocality: 'Vila Exemple', addressRegion: 'Exemple', areaServed: [{ name: 'Vila Exemple' }, { name: 'Poble Exemple' }], geo: { latitude: 40.0, longitude: 0.0 }, postalCode: '00000', streetAddress: 'Carrer Exemple 1' },
      phone: PHONE,
      // El WhatsApp es deriva del telèfon de la demo (regla de contingut: cap xarxa inventada).
      socials: [{ platform: 'whatsapp', url: 'https://wa.me/34600000000' }],
    },
    pages: {
      home: {
        layout: [
          {
            ariaLabel: 'Animation: four abstract compositions that transform into one another.',
            beats: [
              { body: 'A sample website for the Subur core.', heading: 'Small renovations, done well', image: media.heroWorkshop, label: 'Workshop' },
              { body: 'Kitchens, bathrooms and repairs.', heading: 'One team for the whole house', image: media.heroKitchen, label: 'Kitchen' },
              { body: 'A fixed quote before we start.', heading: 'No surprises', image: media.heroBath, label: 'Bathroom' },
              { body: 'And a clean house when we leave.', heading: 'Job done', image: media.heroDone, label: 'Done' },
            ],
            blockType: 'scrollHero',
            primaryCta: pageLink(pages.contacte, 'Write to us'),
            secondaryCta: urlLink('tel:+34600000000', 'Call us'),
          },
          {
            blockType: 'servicesGrid',
            heading: 'Services',
            items: [
              { image: media.serviceKitchen, page: pages.serveis, summary: 'New worktops, taps and cabinets.', tagline: 'Kitchens', title: 'Kitchen' },
              { image: media.serviceBath, page: pages.serveis, summary: 'Shower trays, screens and tiles.', tagline: 'Bathrooms', title: 'Bathroom' },
              { image: media.serviceRepairs, page: pages.serveis, summary: 'Small repairs around the home.', tagline: 'Maintenance', title: 'Repairs' },
            ],
          },
          { blockType: 'note', text: 'Every service can be booked on its own.', title: 'Tailored services' },
          {
            blockType: 'featureList',
            columns: '4',
            heading: 'How we work',
            items: [
              { icon: 'clipboard-check', moment: 'before', text: 'We visit the house and give you a fixed quote.', title: 'Visit' },
              { icon: 'search-check', moment: 'ongoing', text: 'We check every step before moving on.', title: 'Follow-up' },
              { icon: 'house', moment: 'after', text: 'We leave the house clean when we finish.', title: 'Cleaning' },
              { icon: 'package-search', moment: 'during', text: 'We bring the materials and clear them away every day.', title: 'Materials' },
            ],
          },
          { blockType: 'testimonials', heading: 'What clients say', items: [{ author: 'Marta R.', quote: 'They came when they said and left everything clean and tidy.' }, { author: 'Jordi P.', quote: 'The fixed quote was exactly what we ended up paying in the end.' }, { author: 'Núria S.', quote: 'They replaced our shower tray in two days, with no surprises.' }] },
          { blockType: 'ctaBand', heading: 'Got a renovation on hold?', text: 'Tell us about it and we will tell you what it costs.' },
        ],
        meta: { description: 'Small renovations and home maintenance. A sample website for the Subur core.', title: 'Reformes Exemple' },
        slug: 'home',
        title: 'Home',
      },
      serveis: {
        layout: [
          { blockType: 'pageHero', heading: 'Services', image: media.pageServices, lead: 'Everything we do, with a fixed quote.' },
          { blockType: 'statement', image: media.heroDone, text: 'Work done well, first time.', variant: 'quote' },
          { blockType: 'featureList', columns: '2', items: [{ icon: 'sofa', text: 'Furniture assembly and repair.', title: 'Furniture' }, { icon: 'droplets', text: 'Taps, drains and sealant.', title: 'Plumbing' }] },
          {
            blockType: 'taskCatalog',
            groups: [
              { icon: 'sofa', tasks: [{ text: 'Furniture assembly' }, { text: 'Hanging pictures and shelves' }], title: 'Furniture' },
              { icon: 'droplets', tasks: [{ text: 'Replacing taps' }, { text: 'Unblocking drains without machinery' }], title: 'Plumbing' },
              { icon: 'door-open', tasks: [{ text: 'Adjusting doors' }, { text: 'Replacing locks' }], title: 'Doors' },
            ],
          },
          { blockType: 'faq', heading: 'Frequently asked questions', intro: 'What we are asked most often.', items: [{ answer: 'Yes, the quote is fixed.', question: 'Can the quote change?' }, { answer: 'Usually within a week.', question: 'When can you come?' }] },
          { blockType: 'note', text: 'Public liability insurance included.', title: 'Insurance' },
        ],
        meta: { description: 'Services of Reformes Exemple.', title: 'Services | Reformes Exemple' },
        slug: 'serveis',
        title: 'Services',
      },
      contacte: {
        layout: [
          { blockType: 'pageHero', heading: 'Let’s talk', image: media.pageContact, lead: 'Fill in the form or give us a call.' },
          { blockType: 'contact', form: formId, heading: 'Send us a message', text: 'Monday to Friday, 9 am to 6 pm.' },
        ],
        meta: { description: 'Contact Reformes Exemple.', title: 'Contact | Reformes Exemple' },
        slug: 'contacte',
        title: 'Contact',
      },
      'avis-legal': {
        layout: [{ blockType: 'pageHero', heading: 'Legal notice' }, { blockType: 'richTextSection', content: richText(paragraph('A sample website with no real owner.'), heading('h2', 'Contact'), paragraph(`${EMAIL} · ${PHONE}`)) }],
        meta: { title: 'Legal notice | Reformes Exemple' },
        slug: 'avis-legal',
        title: 'Legal notice',
      },
      privacitat: {
        layout: [{ blockType: 'pageHero', heading: 'Privacy policy' }, { blockType: 'richTextSection', content: richText(paragraph('This sample website processes nobody’s data.')) }],
        meta: { title: 'Privacy | Reformes Exemple' },
        slug: 'privacitat',
        title: 'Privacy',
      },
      cookies: {
        layout: [{ blockType: 'pageHero', heading: 'Cookie policy' }, { blockType: 'richTextSection', content: richText(paragraph('Only technical cookies and, with consent, analytics cookies.')) }],
        meta: { title: 'Cookies | Reformes Exemple' },
        slug: 'cookies',
        title: 'Cookies',
      },
    },
  }),
}
