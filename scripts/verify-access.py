from pathlib import Path
import json,urllib.request,urllib.error,sys
config=dict(l.split('=',1) for l in Path('.env.local').read_text().splitlines() if '=' in l)
base=config['VITE_SUPABASE_URL'];key=config['VITE_SUPABASE_PUBLISHABLE_KEY']
accounts=json.loads(Path('.local/accounts.json').read_text(encoding='utf-8'))
ids=json.loads(Path('.local/demo-ids.json').read_text(encoding='utf-8'))
checks=0
def request(path,token=None,method='GET',body=None):
 headers={'apikey':key,'Content-Type':'application/json','Prefer':'return=representation'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.loads(r.read() or b'null')
 except urllib.error.HTTPError as e:
  e.read()
  return e.code,None
def check(condition,label):
 global checks
 if not condition:raise SystemExit('FAIL: '+label)
 checks+=1;print('PASS: '+label)
def login(a):
 status,data=request('/auth/v1/token?grant_type=password',method='POST',body={'email':a['email'],'password':a['password']})
 check(status==200,'Sign-in '+a['role'])
 return data['access_token']
def rows(table,token,query=''):
 status,data=request('/rest/v1/'+table+'?select=*'+query,token)
 check(status==200,'Read '+table)
 return data
admin=login(accounts[0]);network=login(accounts[1]);local=login(accounts[2]);student=login(accounts[3])
check(len(rows('web_schools',admin))==3,'Main administrator sees three schools')
check(len(rows('web_schools',network))==3,'Network sub-admin sees three schools')
check(len(rows('web_schools',local))==1,'School sub-admin sees one school')
check(len(rows('web_students',local))==12,'School sub-admin sees twelve students')
check(len(rows('web_students',student))==1,'Student sees only own student record')
check(len(rows('web_marks',student))==171,'Student sees all 171 personal marks')
check(len(rows('web_payments',student))==3,'Student sees only own three payments')
check(len(rows('web_timetable',student))==20,'Student sees own class timetable')
check(len(rows('web_messages',student))==2,'Student sees own school communications')
other=ids['schools'][1]['id']
check(not rows('web_students',local,'&school_id=eq.'+other),'Forged cross-school read returns no students')
check(not rows('web_payments',student,'&school_id=eq.'+other),'Forged cross-school read returns no payments')
status,_=request('/rest/v1/web_messages',student,'POST',{'school_id':ids['schools'][0]['id'],'title':'Unauthorized','body':'Must fail'})
check(status in [401,403],'Student cannot publish messages')
status,_=request('/rest/v1/web_messages',local,'POST',{'school_id':other,'title':'Unauthorized','body':'Must fail'})
check(status in [401,403],'Sub-admin cannot write another school')
status,_=request('/rest/v1/web_admins',student,'POST',{'user_id':accounts[3]['id']})
check(status in [401,403],'Student cannot promote own account')
status,_=request('/rest/v1/web_schools')
check(status in [401,403],'Anonymous access to private schools is denied')
mark=rows('web_marks',student)[0]
status,_=request('/rest/v1/web_marks?id=eq.'+mark['id'],local,'PATCH',{'score':999999})
check(status==400,'Database rejects marks above maximum')
status,_=request('/rest/v1/web_marks?id=eq.'+mark['id'],student,'PATCH',{'score':0})
check(status in [200,204] and rows('web_marks',student,'&id=eq.'+mark['id'])[0]['score']==mark['score'],'Student cannot change own marks')
member='/rest/v1/web_memberships?user_id=eq.'+accounts[3]['id']
try:
 status,_=request(member,admin,'PATCH',{'active':False});check(status==200,'Administrator can suspend a membership')
 check(not rows('web_schools',student),'Suspended membership loses schools with existing token')
 check(not rows('web_marks',student),'Suspended membership loses marks with existing token')
finally:
 status,_=request(member,admin,'PATCH',{'active':True})
 if status!=200:raise SystemExit('CRITICAL: restore demo membership manually')
school_id=ids['schools'][0]['id']
status,_=request('/rest/v1/web_schools?id=eq.'+school_id,local,'PATCH',{'terms':1})
check(status==400,'Calendar cannot hide existing trimester evaluations')
assignment=rows('web_assignments',student)[0]
status,_=request('/rest/v1/web_assignments?id=eq.'+assignment['id'],local,'PATCH',{'period':4})
check(status==400,'Assignment must fit configured periods')
status,_=request('/rest/v1/web_students?id=eq.'+ids['students'][0]['id'],local,'PATCH',{'class_name':'Other class'})
check(status==400,'Graded student cannot be silently moved to another class')
for a in accounts[4:]:
 t=login(a)
 check(len(rows('web_students',t))==1,'Demo student isolation')
 request('/auth/v1/logout',t,'POST')
aa=rows('web_assignments',student);mm=rows('web_marks',student)
check(sum(float(a['max_score']) for a in aa)==3360,'RDC yearly maxima total 3360')
check(all(0<=float(m['score'])<=float(next(a['max_score'] for a in aa if a['id']==m['assignment_id'])) for m in mm),'All demo marks respect assignment maxima')
for t in [admin,network,local,student]:request('/auth/v1/logout',t,'POST')
print(str(checks)+' checks passed. No credentials logged.')
