#!/usr/bin/env python3
import os, subprocess, signal, sys, shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
env=os.environ.copy()
for line in (root/'.env').read_text().splitlines():
 if line and not line.startswith('#') and '=' in line:
  key,value=line.split('=',1);env.setdefault(key,value)
# npm does not inherit interactive shell aliases or PATH customizations.
# Resolve the actual SDK and expose it to dotnet-watch's child processes.
dotnet = shutil.which('dotnet', path=env.get('PATH'))
if not dotnet:
 candidates = []
 if env.get('DOTNET_ROOT'):
  candidates.append(Path(env['DOTNET_ROOT']) / 'dotnet')
 candidates += [Path.home() / '.dotnet/dotnet',
                Path('/usr/local/share/dotnet/dotnet'),
                Path('/usr/share/dotnet/dotnet')]
 dotnet = next((str(p) for p in candidates if p.is_file() and os.access(p, os.X_OK)), None)
if not dotnet:
 sys.exit('The .NET 10 SDK was not found. Install it or set DOTNET_ROOT to its installation directory.')
sdk_root = str(Path(dotnet).resolve().parent)
env['PATH'] = sdk_root + os.pathsep + env.get('PATH', '')
env.setdefault('DOTNET_ROOT', sdk_root)
# Vite owns frontend assets and browser refresh; dotnet-watch watches C# only.
env['DOTNET_WATCH_SUPPRESS_BROWSER_REFRESH']='1'
env['DOTNET_WATCH_SUPPRESS_STATIC_FILE_HANDLING']='1'
env['ASPNETCORE_ENVIRONMENT']='Development'
env['ASPNETCORE_URLS']='http://127.0.0.1:'+env.get('API_PORT','5191')
env['ConnectionStrings__Database']=f"Host=127.0.0.1;Port={env.get('POSTGRES_PORT','5545')};Database={env['POSTGRES_DB']};Username={env['POSTGRES_USER']};Password={env['POSTGRES_PASSWORD']}"
env['Admin__Email']=env['ADMIN_EMAIL'];env['Admin__Password']=env['ADMIN_PASSWORD']
env['Storage__Path']=str(root/'.data/media');env['DataProtection__Path']=str(root/'.data/keys')
children=[]
def stop(*_):
 for p in children:
  if p.poll() is None: os.killpg(p.pid,signal.SIGTERM)
 for p in children:
  try:p.wait(timeout=10)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL)
 sys.exit(0)
signal.signal(signal.SIGINT,stop);signal.signal(signal.SIGTERM,stop)
children.append(subprocess.Popen([dotnet,'watch','--project','src/Projects.Web','run','--no-launch-profile'],cwd=root,env=env,start_new_session=True))
children.append(subprocess.Popen(['npm','run','dev','--prefix','frontend'],cwd=root,env=env,start_new_session=True))
try:
 while all(p.poll() is None for p in children): children[0].wait(timeout=1)
except subprocess.TimeoutExpired:
 import time
 while all(p.poll() is None for p in children):time.sleep(.5)
stop()
