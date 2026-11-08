from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class Export(unittest.TestCase):
    def test_export_runtime_only_and_refuse_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            dest=Path(temp)/'learneth'
            result=subprocess.run([sys.executable,str(ROOT/'tools/export_site.py'),str(dest)],capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertTrue((dest/'demo/index.html').is_file())
            self.assertTrue((dest/'LICENSE').is_file())
            self.assertFalse((dest/'.git').exists())
            self.assertFalse((dest/'tests').exists())
            self.assertFalse((dest/'CNAME').exists())
            again=subprocess.run([sys.executable,str(ROOT/'tools/export_site.py'),str(dest)],capture_output=True,text=True)
            self.assertNotEqual(again.returncode,0)
if __name__=='__main__': unittest.main()
