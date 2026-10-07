#!/usr/bin/env python3
from pathlib import Path
import argparse, os, secrets

parser=argparse.ArgumentParser()
parser.add_argument('--production', action='store_true')
parser.add_argument('--deploy-path', type=Path)

args=parser.parse_args()

if args.production != bool(args.deploy_path): parser.error('--production and --deploy-path must be used together')

repo=Path(__file__).resolve().parents[1]
folder=args.deploy_path.resolve() if args.production else repo

if not folder.is_dir(): parser.error('Create the deployment folder first')

content=(repo/('.env.production.example' if args.production else '.env.example')).read_text()

for key in ['POSTGRES_PASSWORD','ADMIN_PASSWORD']: content=content.replace(key+'=replace-me',key+'='+secrets.token_hex(24))
fd=os.open(folder/'.env',os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
with os.fdopen(fd,'w') as f: f.write(content)
print('Created private .env; existing credentials are never overwritten.')
