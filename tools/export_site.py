"""Export the public runtime to a new deployment directory."""
from pathlib import Path
import shutil
import sys

def export(destination):
    root=Path(__file__).resolve().parents[1]
    destination=Path(destination)
    if destination.exists():
        raise SystemExit('Destination already exists; review and choose a new staging directory.')
    destination.mkdir(parents=True)
    for name in ('index.html','assets','demo','LICENSE','NOTICE','LICENSING.md','.nojekyll'):
        source=root/name
        if source.is_dir(): shutil.copytree(source,destination/name)
        else: shutil.copy2(source,destination/name)
    print('Exported public runtime to '+str(destination))

if __name__=='__main__':
    if len(sys.argv)!=2: raise SystemExit('Usage: python3 tools/export_site.py NEW_DESTINATION')
    export(sys.argv[1])
