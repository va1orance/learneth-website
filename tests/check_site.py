"""Dependency-free checks for a private, portable static site."""
from html.parser import HTMLParser
from pathlib import Path
import json
import unittest

ROOT = Path(__file__).resolve().parents[1]

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.refs = []
        self.headings = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        for key in ("src", "href"):
            if key in attrs:
                self.refs.append(attrs[key])
        if tag == "h1":
            self.headings.append(tag)

class SiteTests(unittest.TestCase):
    def setUp(self):
        self.doc = Document()
        self.doc.feed((ROOT / "index.html").read_text())
    def test_local_references_exist(self):
        for ref in self.doc.refs:
            if ref.startswith("#"):
                if len(ref) > 1:
                    self.assertIn(ref[1:], self.doc.ids)
            else:
                self.assertNotIn("://", ref, "No external dependencies in the foundation")
                self.assertTrue((ROOT / ref).is_file(), ref)
    def test_unique_ids_and_title_hierarchy(self):
        self.assertEqual(len(self.doc.ids), len(set(self.doc.ids)))
        self.assertEqual(len(self.doc.headings), 1)
    def test_demo_elements(self):
        for value in ("choices", "response", "reset"):
            self.assertIn(value, self.doc.ids)
        self.assertIn('aria-live="polite"', (ROOT / "index.html").read_text())
    def test_package_private(self):
        self.assertIs(json.loads((ROOT / "package.json").read_text())["private"], True)

if __name__ == "__main__":
    unittest.main()
