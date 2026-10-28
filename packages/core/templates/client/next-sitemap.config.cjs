const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  exclude: ['/pages-sitemap.xml', '/*'],
  generateRobotsTxt: true,
  robotsTxtOptions: {
    additionalSitemaps: [`${SITE_URL}/pages-sitemap.xml`],
    policies: [{ allow: ['/api/media/file/'], disallow: ['/admin', '/api/', '/next'], userAgent: '*' }],
  },
  siteUrl: SITE_URL,
}
