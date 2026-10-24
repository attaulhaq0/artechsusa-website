"""Check the delivered routes, search metadata and local asset references."""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / 'public_html'
ORIGIN = 'https://artechsusa.com'


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.tags = []
        self.title = ''
        self.in_title = False
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))
        if tag == 'title':
            self.in_title = True

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data

    def meta(self, name):
        return next((attrs.get('content', '') for tag, attrs in self.tags
                     if tag == 'meta' and attrs.get('name') == name), '')

    def canonical(self):
        return next((attrs.get('href', '') for tag, attrs in self.tags
                     if tag == 'link' and attrs.get('rel') == 'canonical'), '')


def local_file(path):
    candidate = ROOT / unquote(path).lstrip('/')
    return candidate / 'index.html' if candidate.is_dir() else candidate


class SiteContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages = sorted(ROOT.rglob('index.html')) + [ROOT / '404.html']
        cls.docs = {file: Document(file.read_text(encoding='utf-8')) for file in cls.pages}

    def test_routes_and_main_landmarks(self):
        self.assertEqual(len(self.pages), 27)
        for file, doc in self.docs.items():
            with self.subTest(page=str(file.relative_to(ROOT))):
                self.assertTrue(doc.title.strip())
                self.assertEqual(sum(tag == 'main' for tag, _ in doc.tags), 1)
                self.assertEqual(sum(tag == 'h1' for tag, _ in doc.tags), 1)

    def test_indexable_metadata_and_canonical_urls(self):
        titles, descriptions = set(), set()
        for file, doc in self.docs.items():
            if 'noindex' in doc.meta('robots'):
                continue
            with self.subTest(page=str(file.relative_to(ROOT))):
                self.assertTrue(doc.meta('description'))
                self.assertNotIn(doc.title, titles)
                self.assertNotIn(doc.meta('description'), descriptions)
                titles.add(doc.title)
                descriptions.add(doc.meta('description'))
                relative = file.relative_to(ROOT).as_posix()
                route = '/' + relative.removesuffix('index.html')
                self.assertEqual(doc.canonical(), ORIGIN + route)

    def test_sitemap_matches_indexable_pages(self):
        ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
        locations = [node.text for node in ET.parse(ROOT / 'sitemap.xml').findall('s:url/s:loc', ns)]
        expected = {doc.canonical() for doc in self.docs.values() if 'noindex' not in doc.meta('robots')}
        self.assertEqual(len(locations), 24)
        self.assertEqual(len(locations), len(set(locations)))
        self.assertEqual(set(locations), expected)
        self.assertIn('Disallow: /api/', (ROOT / 'robots.txt').read_text())

    def test_local_links_and_responsive_images_exist(self):
        for file, doc in self.docs.items():
            for tag, attrs in doc.tags:
                values = [attrs.get(key, '') for key in ('src', 'href', 'poster', 'data-src')]
                values += [part.strip().split()[0] for part in attrs.get('srcset', '').split(',') if part.strip()]
                for value in values:
                    url = urlsplit(value)
                    if url.netloc or not url.path.startswith('/'):
                        continue
                    with self.subTest(page=str(file.relative_to(ROOT)), link=value):
                        self.assertTrue(local_file(url.path).is_file(), value)

    def test_structured_data_and_css_assets(self):
        for file in self.pages:
            text = file.read_text(encoding='utf-8')
            blocks = re.findall(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', text, re.S)
            for block in blocks:
                with self.subTest(page=str(file.relative_to(ROOT))):
                    data = json.loads(block)
                    nodes = data if isinstance(data, list) else [data]
                    self.assertTrue(nodes)
                    for node in nodes:
                        self.assertIsInstance(node, dict)
                        self.assertIn('@type', node)
        for file in ROOT.rglob('*.css'):
            text = file.read_text(encoding='utf-8')
            for value in re.findall(r'url\(\s*[\"\']?([^\)\"\']+)', text):
                url = urlsplit(value.strip())
                if url.netloc or url.scheme or not url.path:
                    continue
                candidate = local_file(url.path) if url.path.startswith('/') else file.parent / unquote(url.path)
                with self.subTest(css=str(file.relative_to(ROOT)), asset=value):
                    self.assertTrue(candidate.is_file())


if __name__ == '__main__':
    unittest.main(verbosity=2)
