#!/usr/bin/env python3
import os, stat, sys
from pathlib import Path
path=Path(sys.argv[1])
if path.is_symlink() or not path.is_file():sys.exit('Create the server-owned .env before deploying.')
meta=path.stat()
if stat.S_IMODE(meta.st_mode)!=0o600 or meta.st_uid!=os.geteuid():sys.exit('Server .env must belong to the deploy user with mode 0600.')
values={}
for line in path.read_text().splitlines():
 if line and not line.startswith('#') and '=' in line:
  key,value=line.split('=',1);values[key]=value
for key in ['POSTGRES_PASSWORD','ADMIN_EMAIL','ADMIN_PASSWORD']:
 value=values.get(key,'')
 if not value or value=='replace-me':sys.exit('Missing server setting: '+key)
if len(values['POSTGRES_PASSWORD'])<24 or len(values['ADMIN_PASSWORD'])<16:sys.exit('Generate sufficiently long server credentials.')
if not all(c in '0123456789abcdef' for c in values['POSTGRES_PASSWORD']):sys.exit('Use a generated hexadecimal database password to preserve connection-string syntax.')
print('Server configuration validated without exporting its values.')
