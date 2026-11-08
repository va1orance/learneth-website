"""Dependency-free checks for both public pages."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import unittest
ROOT = Path(__file__).resolve().parents[1]
class Document(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids=[]; self.refs=[]; self.headings=[]
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if 'id' in attrs: self.ids.append(attrs['id'])
        for key in ('src','href'):
            if key in attrs: self.refs.append(attrs[key])
        if tag=='h1': self.headings.append(tag)
class SiteTests(unittest.TestCase):
    def test_local_references_exist(self):
        for page in [ROOT/'index.html',ROOT/'demo/index.html']:
            doc=Document(); doc.feed(page.read_text())
            for ref in doc.refs:
                parts=urlsplit(ref)
                if parts.scheme:
                    self.assertEqual(parts.scheme,'https'); continue
                target=(page.parent/unquote(parts.path)).resolve() if parts.path else page
                if target.is_dir(): target=target/'index.html'
                self.assertTrue(target.is_file(), str(target))
                if parts.fragment:
                    other=Document(); other.feed(target.read_text())
                    self.assertIn(parts.fragment,other.ids)
    def test_unique_ids_and_title_hierarchy(self):
        for page in [ROOT/'index.html',ROOT/'demo/index.html']:
            doc=Document(); doc.feed(page.read_text())
            self.assertEqual(len(doc.ids),len(set(doc.ids)))
            self.assertEqual(len(doc.headings),1)
    def test_demo_elements(self):
        text=(ROOT/'index.html').read_text(); doc=Document(); doc.feed(text)
        for value in ('sample-form','sample-answer','lesson-top','response','reset'): self.assertIn(value,doc.ids)
        self.assertIn('aria-live="polite"',text)
    def test_package_private(self):
        self.assertIs(json.loads((ROOT/'package.json').read_text())['private'],True)
if __name__=='__main__': unittest.main()
