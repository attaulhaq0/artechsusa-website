# Technical SEO

The delivered site exposes crawlable HTML for each route. Search metadata is in the page HTML, rather than waiting for JavaScript rendering.

| Implementation | Location |
| --- | --- |
| Unique page titles and descriptions | Each `public_html/**/index.html` |
| Canonical URLs and social sharing metadata | Page `<head>` elements |
| Organization, service, breadcrumb and relevant page schema | JSON-LD in the HTML |
| 24 indexable URLs | `public_html/sitemap.xml` |
| Crawler rules; form endpoints excluded | `public_html/robots.txt` |
| Non-indexable confirmation, application and error pages | Page robots metadata |
| HTTPS, canonical hostname, compression and caching | `public_html/.htaccess` |
| Consent-gated Google Analytics events | `public_html/analytics.js` |

`python tests/test_site.py` checks route coverage, unique metadata, canonical URLs, sitemap membership, JSON-LD syntax and local dependencies. Analytics sends approved event names and canonical paths; form details and résumé files are excluded.

Search Console ownership and sitemap submission were completed for the client. Search ranking, traffic growth and field performance are not inferred from that setup.
