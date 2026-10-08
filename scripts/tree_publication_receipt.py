"""Read-only GitHub server receipt verification; no local-date publication claims."""
import json, re, base64, hashlib
from urllib.request import Request, urlopen
from urllib.parse import quote
from capture_tree_forecast import instant
REPOSITORY='madeska/paddock-iq'
BASE='https://api.github.com/repos/'+REPOSITORY

def fetch_public_json(url):
 if not url.startswith(BASE+'/'):raise ValueError('Untrusted receipt endpoint')
 request=Request(url,headers={'Accept':'application/vnd.github+json','User-Agent':'Paddock-IQ-prospective-audit'})
 with urlopen(request,timeout=30) as response:
  if not response.url.startswith(BASE+'/'):raise ValueError('Unexpected receipt redirect')
  return json.loads(response.read())

def normalized_hash(raw):return hashlib.sha256(raw.replace(b'\r\n',b'\n')).hexdigest()

def verify_publication_receipt(receipt,snapshot_bytes,lock_at,transport=fetch_public_json):
 run_id=receipt['runId'];commit=receipt['commit'];path=receipt['path']
 if not isinstance(run_id,int) or isinstance(run_id,bool) or run_id<1 or not re.fullmatch('[0-9a-f]{40}',commit):raise ValueError('Invalid publication identity')
 if not isinstance(path,str) or not path.startswith('docs/prospective-tree/') or any(p in ['','..','.'] for p in path.split('/')) or '\\' in path:raise ValueError('Invalid publication path')
 run=transport(BASE+'/actions/runs/'+str(run_id))
 if run.get('id')!=run_id or run.get('head_sha')!=commit or run.get('repository',{}).get('full_name')!=REPOSITORY or run.get('head_repository',{}).get('full_name')!=REPOSITORY:raise ValueError('Publication repository/commit mismatch')
 if instant(run['created_at'])>=instant(lock_at):raise ValueError('Publication occurred after lock')
 content=transport(BASE+'/contents/'+quote(path,safe='/')+'?ref='+commit)
 if content.get('type')!='file' or content.get('path')!=path or content.get('encoding')!='base64':raise ValueError('Missing committed publication file')
 remote=base64.b64decode(''.join(content['content'].split()),validate=True)
 if normalized_hash(remote)!=normalized_hash(snapshot_bytes):raise ValueError('Published snapshot differs')
 return dict(repository=REPOSITORY,commit=commit,path=path,runId=run_id,createdAt=run['created_at'],snapshotLFNormalizedSHA256=normalized_hash(remote),url='https://github.com/'+REPOSITORY+'/actions/runs/'+str(run_id),note='Proves committed bytes existed at server run creation; not source accuracy or workflow success')
