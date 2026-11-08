from pathlib import Path
import unittest
from html.parser import HTMLParser
ROOT = Path(__file__).resolve().parents[1]
class Routes(unittest.TestCase):
    def test_separate_demo_with_information_preserved(self):
        info = (ROOT/'index.html').read_text()
        self.assertIn('href="demo/"', info)
        self.assertIn('id="approach"', info)
        self.assertIn('id="setup"', info)
        self.assertNotIn('id="sample-form"', info)
        self.assertTrue((ROOT/'demo/index.html').is_file())
        demo = (ROOT/'demo/index.html').read_text()
        self.assertIn('id="sample-form"', demo)
        self.assertIn('href="../"', demo)
        self.assertIn('src="../assets/site.js"', demo)
        self.assertNotIn('learneth.valorance.net', (ROOT/'README.md').read_text())
        self.assertFalse((ROOT/'CNAME').exists(), 'Path deployment must inherit the existing domain')
if __name__ == '__main__': unittest.main()
