import {chromium} from '@playwright/test';
import {readFileSync,mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
const accounts=JSON.parse(readFileSync('.local/accounts.json','utf8'));
mkdirSync('.local/screenshots',{recursive:true});
const published=process.env.TEST_URL;
const server=published?null:spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5176'],{stdio:'ignore',windowsHide:true});
const base=published||'http://127.0.0.1:5176/suiviscolaire-web/';
let browser;let count=0;
const check=(ok,label)=>{if(!ok)throw Error(label);count++;console.log('PASS: '+label)};
try{
 for(let i=0;i<30;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,500))}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',()=>errors.push('runtime'));
 async function login(account){
  await page.goto(base);await page.getByLabel('Adresse e-mail').fill(account.email);
  await page.getByLabel('Mot de passe',{exact:true}).fill(account.password);
  await page.getByRole('button',{name:'Se connecter',exact:true}).click();
 }
 async function logout(){await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();await page.getByRole('button',{name:'Se connecter',exact:true}).waitFor()}
 await page.goto(base);
 await page.screenshot({path:'.local/screenshots/login.png',fullPage:true});
 await login(accounts[0]);
 await page.getByRole('heading',{name:'Vos établissements'}).waitFor();
 await page.locator('.school-card').first().waitFor();
 check(await page.locator('.school-card').count()===3,'Main admin school directory');
 await page.screenshot({path:'.local/screenshots/schools.png',fullPage:true});
 await page.locator('.school-card').filter({hasText:'Complexe scolaire du Fleuve'}).click();
 await page.getByText('Élèves inscrits',{exact:true}).waitFor();
 check(await page.locator('.stat').first().textContent().then(t=>t.includes('12')),'School dashboard contains twelve students');
 await page.screenshot({path:'.local/screenshots/dashboard.png',fullPage:true});
 await page.getByRole('button',{name:'Bulletins',exact:true}).click();
 await page.locator('.bulletin').waitFor();
 check((await page.locator('.bulletin-result').textContent()).includes('3360'),'RDC report has 3360 maximum');
 await page.screenshot({path:'.local/screenshots/bulletin.png',fullPage:true});
 await page.pdf({path:'.local/screenshots/bulletin.pdf',format:'A4',landscape:false,printBackground:true});
 await page.getByRole('button',{name:'Paramètres',exact:true}).click();
 await page.getByRole('heading',{name:'Maxima des branches'}).waitFor();
 check(await page.locator('.subject-editor').count()===19,'Nineteen configurable branches');
 await logout();
 await login(accounts[2]);
 await page.getByText('Élèves inscrits',{exact:true}).waitFor();
 await page.locator('.school-switch').click();
 await page.getByRole('heading',{name:'Vos établissements'}).waitFor();
 check(await page.locator('.school-card').count()===1,'Single-school sub-admin interface');
 await logout();
 await login(accounts[3]);
 await page.getByText('Moyenne des notes publiées',{exact:true}).waitFor();
 check(await page.getByRole('button',{name:'Paramètres',exact:true}).count()===0,'Student has no administration navigation');
 await page.getByRole('button',{name:'Notes & devoirs',exact:true}).click();
 await page.getByRole('heading',{name:'Mes notes',exact:true}).waitFor();
 check(await page.locator('tbody tr').count()===171,'Student assignment marks visible');
 await page.getByRole('button',{name:'Paiements',exact:true}).click();
 await page.getByRole('heading',{name:'Historique des paiements'}).waitFor();
 check(await page.locator('tbody tr').count()===3,'Student payment history visible');
 await page.getByRole('button',{name:'Communications',exact:true}).click();
 check(await page.locator('.message-list article').count()===2,'Student school communications visible');
 await page.getByRole('button',{name:'Emploi du temps',exact:true}).click();
 check(await page.locator('.day article').count()===20,'Student timetable visible');
 await page.getByRole('button',{name:'Vue d’ensemble',exact:true}).first().click();
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'.local/screenshots/student-mobile.png',fullPage:true});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile page has no horizontal overflow');
 check(errors.length===0,'No browser runtime errors');
 await logout();
 await context.close();
 console.log(count+' browser checks passed.');
}catch(e){console.error('Browser verification failed: '+(e instanceof Error?e.message.split('\n')[0]:'unknown failure'));process.exitCode=1}
finally{if(browser)await browser.close();if(server)server.kill()}
