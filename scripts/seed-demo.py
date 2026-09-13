from pathlib import Path
import json,secrets,urllib.request,uuid,random
url='https://qcthoclsgckohaaamlki.supabase.co/functions/v1/web-demo-setup'
token=json.loads(Path('.local/setup.json').read_text())['token']
def call(body):
 req=urllib.request.Request(url,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','x-setup-token':token})
 try:
  with urllib.request.urlopen(req,timeout=120) as r:return json.load(r)
 except Exception:raise SystemExit('Remote setup failed; no credentials printed.')
p=Path('.local/accounts.json')
if not p.exists():
 accounts=[{'email':'admin@suiviscolaire.example','name':'Administrateur principal','role':'mainadmin'},{'email':'reseau@suiviscolaire.example','name':'Responsable du réseau','role':'subadmin'},{'email':'fleuve@suiviscolaire.example','name':'Responsable du Fleuve','role':'subadmin'}]
 surnames=['Kabeya','Ilunga','Kalenga','Mbuyi','Kanku','Tshibanda','Kasongo','Mwamba','Mutombo','Banza','Lukusa','Mukendi']
 first=['Grâce','Daniel','Sarah','Joël','Esther','Samuel','Ruth','David','Naomi','Isaac','Marie','Paul']
 for school in range(3):
  for i in range(12):accounts.append({'email':f'eleve{school+1}.{i+1:02}@suiviscolaire.example','name':first[i]+' '+surnames[(i+school*3)%12],'role':'student','school':school,'index':i})
 for a in accounts:a['password']=secrets.token_urlsafe(18)
 p.write_text(json.dumps(accounts,ensure_ascii=False,indent=2),encoding='utf-8')
accounts=json.loads(p.read_text(encoding='utf-8'))
users=call({'action':'users','users':accounts})['users']
ids={u['email']:u['id'] for u in users}
for a in accounts:a['id']=ids[a['email']]
p.write_text(json.dumps(accounts,ensure_ascii=False,indent=2),encoding='utf-8')
Path('.local/DEMO_CREDENTIALS.md').write_text('# Comptes de démonstration — fichier privé\n\n| Nom | Rôle | Adresse | Mot de passe |\n|---|---|---|---|\n'+'\n'.join('|'+a['name']+'|'+a['role']+'|'+a['email']+'|'+a['password']+'|' for a in accounts),encoding='utf-8')
def uid(name):return str(uuid.uuid5(uuid.NAMESPACE_URL,'suiviscolaire-web-demo/'+name))
tables={}
schools=[{'id':uid('school/'+str(i)),'name':name,'city':city,'currency':currency} for i,(name,city,currency) in enumerate([('Complexe scolaire du Fleuve','Kinshasa','CDF'),('École Lumière','Lubumbashi','USD'),('Institut Horizon','Goma','CDF')])]
tables['web_admins']=[{'user_id':accounts[0]['id']}]
tables['web_schools']=schools
tables['web_memberships']=[{'user_id':accounts[1]['id'],'school_id':s['id'],'role':'subadmin'} for s in schools]+[{'user_id':accounts[2]['id'],'school_id':schools[0]['id'],'role':'subadmin'}]
students=[]
for a in accounts[3:]:
 s=schools[a['school']]
 student={'id':uid(a['email']),'school_id':s['id'],'user_id':a['id'],'name':a['name'],'class_name':'1ère primaire','sex':'F' if a['index']%2==0 else 'M','birth_date':f"2018-{a['index']+1:02}-12"}
 students.append(student)
 tables['web_memberships'].append({'user_id':a['id'],'school_id':s['id'],'role':'student'})
tables['web_students']=students
branches=[('Langues congolaises · Expression orale','LANGUES',20),('Langues congolaises · Expression écrite','LANGUES',20),('Français · Vocabulaire','LANGUES',10),('Français · Expression orale','LANGUES',20),('Lecture-écriture en langues congolaises','LANGUES',30),('Mesures des grandeurs','MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',10),('Formes géométriques','MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',10),('Numération','MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',20),('Opérations','MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',20),('Problèmes','MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',20),('Sciences d’éveil','MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',20),('Technologie','MATHÉMATIQUES, SCIENCES ET TECHNOLOGIE',10),('Éducation civique et morale','UNIVERS SOCIAL ET ENVIRONNEMENT',10),('Éducation santé et environnement','UNIVERS SOCIAL ET ENVIRONNEMENT',10),('Arts plastiques','ARTS',10),('Arts dramatiques','ARTS',10),('Éducation physique et sportive','DÉVELOPPEMENT PERSONNEL',10),('Initiation aux travaux productifs','DÉVELOPPEMENT PERSONNEL',10),('Religion','DÉVELOPPEMENT PERSONNEL',10)]
subjects=[];assignments=[];marks=[];payments=[];messages=[];timetable=[]
rng=random.Random(42)
for si,s in enumerate(schools):
 for j,(name,domain,maximum) in enumerate(branches):
  subject={'id':uid(f'subject/{si}/{j}'),'school_id':s['id'],'name':name,'domain':domain,'period_max':maximum,'exam_max':maximum*2,'sort_order':j}
  subjects.append(subject)
  for term in range(1,4):
   for period in [1,2,0]:
    assignment={'id':uid(f'assignment/{si}/{j}/{term}/{period}'),'school_id':s['id'],'subject_id':subject['id'],'class_name':'1ère primaire','title':('Examen' if period==0 else f'Période {(term-1)*2+period}')+' · '+name,'term':term,'period':period,'max_score':maximum*(2 if period==0 else 1),'due_date':f'2026-{term*3:02}-{10+period:02}','published':True}
    assignments.append(assignment)
    for st in [x for x in students if x['school_id']==s['id']]:
     marks.append({'id':uid(st['id']+'/'+assignment['id']),'school_id':s['id'],'student_id':st['id'],'assignment_id':assignment['id'],'score':round(assignment['max_score']*rng.uniform(.52,.98),1)})
 for st in [x for x in students if x['school_id']==s['id']]:
  for month in [1,2,3]:payments.append({'id':uid('payment/'+st['id']+str(month)),'school_id':s['id'],'student_id':st['id'],'label':'Frais scolaires · trimestre '+str(month),'amount':50000 if s['currency']=='CDF' else 25,'currency':s['currency'],'paid_on':f'2026-0{month}-05','reference':'DEMO-'+st['id'][:8]+'-'+str(month)})
 messages += [{'id':uid('message/'+str(si)),'school_id':s['id'],'title':'Bienvenue dans votre espace scolaire','body':'Retrouvez vos notes, votre bulletin, vos paiements et votre emploi du temps. Les données présentées sont fictives.'},{'id':uid('message2/'+str(si)),'school_id':s['id'],'title':'Rencontre parents-école','body':'La direction vous invite à consulter le secrétariat pour préparer le prochain entretien pédagogique.'}]
 for day in range(1,6):
  for h,subject in [(8,'Français'),(9,'Mathématiques'),(10,'Sciences d’éveil'),(11,'Arts et activités')]:
   timetable.append({'id':uid(f'time/{si}/{day}/{h}'),'school_id':s['id'],'class_name':'1ère primaire','day':day,'starts_at':f'{h:02}:00','ends_at':f'{h:02}:50','subject':subject,'teacher':'Mme '+['Kabeya','Ilunga','Kalenga'][si]})
tables.update(web_subjects=subjects,web_assignments=assignments,web_marks=marks,web_payments=payments,web_messages=messages,web_timetable=timetable)
for table,rows in tables.items():
 for offset in range(0,len(rows),300):call({'table':table,'rows':rows[offset:offset+300]})
 print(table+': '+str(len(rows)))
Path('.local/demo-ids.json').write_text(json.dumps({'schools':schools,'students':students}),encoding='utf-8')
