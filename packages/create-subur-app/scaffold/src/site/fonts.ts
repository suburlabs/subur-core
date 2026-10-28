import { Source_Sans_3, Source_Serif_4 } from 'next/font/google'

const display = Source_Serif_4({ display: 'swap', subsets: ['latin', 'latin-ext'], variable: '--font-display-face' })
const text = Source_Sans_3({ display: 'swap', subsets: ['latin', 'latin-ext'], variable: '--font-text-face' })

export const fontVariables = `${display.variable} ${text.variable}`
