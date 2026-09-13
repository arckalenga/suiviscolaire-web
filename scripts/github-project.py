from pathlib import Path
import json,urllib.request,urllib.error,subprocess,os,sys
env=os.environ.copy();env['GIT_TERMINAL_PROMPT']='0';env['GCM_INTERACTIVE']='never'
r=subprocess.run(['git','credential','fill'],input=b'protocol=https\nhost=github.com\n\n',stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,timeout=25)
creds=dict(l.split('=',1) for l in r.stdout.decode().splitlines() if '=' in l);token=creds.get('password')
if not token:raise SystemExit('GitHub authentication unavailable.')
def api(path,method='GET',body=None):
 req=urllib.request.Request('https://api.github.com'+path,data=json.dumps(body).encode() if body is not None else None,method=method,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'SuiviScolaire-setup'})
 try:
  with urllib.request.urlopen(req,timeout=30) as response:return response.status,json.loads(response.read() or b'null')
 except urllib.error.HTTPError as e:e.read();return e.code,None
status,user=api('/user')
if status!=200 or user['login']!='arckalenga':raise SystemExit('Unexpected GitHub account; stopping.')
repo='/repos/arckalenga/suiviscolaire-web'
mode=sys.argv[1] if len(sys.argv)>1 else 'status'
if mode=='create':
 status,data=api(repo)
 if status==404:
  status,data=api('/user/repos','POST',{'name':'suiviscolaire-web','description':'SuiviScolaire — React, TypeScript and Supabase school management demonstration for the DRC.','private':False,'auto_init':False})
  if status!=201:raise SystemExit('Repository creation failed: HTTP '+str(status))
  Path('.local/github-created.json').write_text(json.dumps({'repository':data['full_name']}))
 elif status==200 and not Path('.local/github-created.json').exists():raise SystemExit('Repository already exists; stopping to avoid changing unrelated work.')
 elif status!=200:raise SystemExit('Repository lookup failed: HTTP '+str(status))
 config=dict(l.split('=',1) for l in Path('.env.local').read_text().splitlines() if '=' in l)
 for name in ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY']:
  status,_=api(repo+'/actions/variables','POST',{'name':name,'value':config[name]})
  if status==409:status,_=api(repo+'/actions/variables/'+name,'PATCH',{'name':name,'value':config[name]})
  if status not in [201,204]:raise SystemExit('Build variable setup failed: HTTP '+str(status))
 print('Repository ready: https://github.com/arckalenga/suiviscolaire-web')
elif mode=='pages':
 status,data=api(repo+'/pages')
 if status==404:status,data=api(repo+'/pages','POST',{'build_type':'workflow'})
 if status not in [200,201,204]:raise SystemExit('Pages setup failed: HTTP '+str(status))
 print('GitHub Pages enabled.')
elif mode=='status':
 status,data=api(repo+'/actions/runs?per_page=3')
 if status!=200:raise SystemExit('Workflow status unavailable: HTTP '+str(status))
 for run in data['workflow_runs']:print(json.dumps({k:run.get(k) for k in ['id','status','conclusion','html_url','head_sha']}))
elif mode=='dispatch':
 status,_=api(repo+'/actions/workflows/pages.yml/dispatches','POST',{'ref':'codex/main'})
 print('Workflow dispatch HTTP '+str(status))
elif mode=='scan':
 tracked=subprocess.run(['git','ls-files','-z'],stdout=subprocess.PIPE,check=True).stdout.decode().split('\0')
 secrets=[token,json.loads(Path('.local/setup.json').read_text())['token']]+[a['password'] for a in json.loads(Path('.local/accounts.json').read_text(encoding='utf-8'))]
 for filename in filter(None,tracked):
  if filename.startswith('.local/') or filename.startswith('.env') and filename!='.env.example':raise SystemExit('Private file staged: '+filename)
  content=Path(filename).read_bytes()
  if any(value.encode() in content for value in secrets):raise SystemExit('Secret detected in staged file: '+filename)
 print('Secret scan passed: no generated passwords, setup token or GitHub credential in tracked files.')
