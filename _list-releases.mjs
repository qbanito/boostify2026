import 'dotenv/config';
import { GoogleAuth } from 'google-auth-library';
const PROJECT = process.env.FIREBASE_PROJECT_ID;
let sa=null; try{sa=JSON.parse(process.env.FIREBASE_ADMIN_KEY||'')}catch{}
const auth=new GoogleAuth({credentials:{client_email:sa?.client_email||process.env.FIREBASE_CLIENT_EMAIL,private_key:(sa?.private_key||process.env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n')},scopes:['https://www.googleapis.com/auth/firebase']});
const c=await auth.getClient();const t=(await c.getAccessToken()).token;
const r=await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases`,{headers:{Authorization:`Bearer ${t}`}});
const j=await r.json();
console.log((j.releases||[]).map(x=>x.name.split('/releases/')[1]).join('\n'));
