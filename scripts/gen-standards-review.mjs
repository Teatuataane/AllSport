#!/usr/bin/env node
// Recomputes "where the club lands" in docs/designs/grading-standards-review.md.
//
// The proposed standards live in S below. Change a number, re-run, and see who
// moves — that is the whole point of the review loop, and it is why the tables
// in the doc are GENERATED rather than typed. Same rule the difficulty sheet
// follows: a hand-typed table drifts from the numbers it claims to describe.
//
// Reads production with the public anon key. Writes nothing.
//   node scripts/gen-standards-review.mjs
//
// Standards are deliberately NOT in lib/. They stay here until the numbers stop
// moving, so nothing ships a half-settled ladder.

import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2))
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!URL_ || !KEY) throw new Error('.env.local is missing the Supabase URL or anon key')

// PostgREST caps a response at 1000 rows, so anything unbounded must be paged.
async function all(path) {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${URL_}/rest/v1/${path}&limit=1000&offset=${offset}`, { headers: { apikey: KEY } })
    if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`)
    const page = await res.json()
    out.push(...page)
    if (page.length < 1000) return out
  }
}

const [rows, sessionEvents, players] = await Promise.all([
  all('results?select=player_id,event_id,raw_score,difficulty_tier,score_label&order=id.asc'),
  all('session_events?select=id,event_name&order=id.asc'),
  all('players_public?select=id,display_name,division,age_years&order=id.asc'),
])
const se = Object.fromEntries(sessionEvents.map((e) => [e.id, e]))
const pl = Object.fromEntries(players.map((p) => [p.id, p]))
const G=['Kiwikiwi','Whero','Karaka','Kōwhai','Kākāriki','Kahurangi','Poroporo','Parahi','Hiriwa','Kōura','Uenuku','Taniwha']
const PCT=['any','90%','80%','70%','60%','50%','40%','30%','20%','10%','5%','1%']
const F={U12:{s:.45,p:.45,e:.70,k:.55},U14:{s:.60,p:.60,e:.80,k:.70},U16:{s:.80,p:.80,e:.90,k:.85},
 Open:{s:1,p:1,e:1,k:1},Masters:{s:.88,p:.88,e:.90,k:1},Grand:{s:.72,p:.72,e:.78,k:.95}}
const band=p=>{const d=p.division||'';if(/Grandmaster/.test(d))return'Grand';if(/Masters/.test(d))return'Masters';
 if(/Junior|Youth/.test(d)){const a=p.age_years;return a==null?'U14':a<12?'U12':a<14?'U14':'U16'}return'Open'}
const sex=p=>/Women/.test(p.division||'')?'F':/Men/.test(p.division||'')?'M':null

// Proposed standards. Untiered: a plain number. Tiered: [rungIndex0, value].
const S={
 'Pause Bench':{cat:'s',kind:'flat',unit:'kg',
   M:[20,30,40,50,57,65,75,85,95,110,125,145], F:[10,15,20,25,30,35,42,50,57,65,75,90]},
 'Vertical Jump':{cat:'p',kind:'flat',unit:'cm',
   M:[10,20,27,33,39,45,51,56,61,66,71,76], F:[8,15,20,25,29,33,38,43,48,53,58,63]},
 'Pushup Contest':{cat:'e',kind:'tier',
   M:[[0,5],[1,5],[1,15],[2,5],[2,12],[2,20],[2,30],[2,45],[3,1],[3,3],[4,3],[5,3]],
   F:[[0,5],[1,5],[1,12],[2,3],[2,8],[2,14],[2,22],[2,33],[3,1],[3,2],[4,2],[5,2]]},
 'Jump Rope':{cat:'k',kind:'tier',
   M:[[0,10],[0,25],[0,50],[0,100],[1,25],[2,5],[2,15],[3,5],[3,15],[4,5],[5,5],[5,20]],
   F:[[0,10],[0,25],[0,50],[0,100],[1,25],[2,5],[2,15],[3,5],[3,15],[4,5],[5,5],[5,20]]},
}
const TIERNAME={'Pushup Contest':['D1 Elev Knee','D2 Knee','D3 Push Up','D4 1 Arm','D5 HS Pushup','D6 Deficit HS'],
 'Jump Rope':['D1 Basic','D2 Alternating','D3 Criss-Cross','D4 Double Under','D5 Single Dutch','D6 Double Dutch']}

const gradeOf=(ev,raw,p)=>{
 const st=S[ev], f=F[band(p)][st.cat], base=st[sex(p)||'M']
 let g=-1
 base.forEach((b,i)=>{
  const need = st.kind==='flat' ? b*f : b[0]*10000 + Math.max(1,Math.round(b[1]*f))
  if(raw>=need) g=i
 })
 return g
}
for(const ev of Object.keys(S)){
 const best=new Map()
 for(const r of rows){const e=se[r.event_id]; if(!e||e.event_name!==ev||!r.player_id) continue
  const prev=best.get(r.player_id); if(!prev||r.raw_score>prev.raw_score) best.set(r.player_id,r)}
 const list=[...best.entries()].map(([id,r])=>({p:pl[id]||{display_name:'?'},r}))
   .sort((a,b)=>b.r.raw_score-a.r.raw_score)
 const st=S[ev]
 console.log('\n=== '+ev+' ===')
 const show=(arr)=>arr.map((b)=>st.kind==='flat'? b+st.unit : (TIERNAME[ev][b[0]]+'·'+b[1])).join('  |  ')
 console.log('  M: '+show(st.M)); if(st.F.join()!==st.M.join()) console.log('  F: '+show(st.F))
 console.log('  ---- where the club lands ----')
 const hist={}
 for(const {p,r} of list){const g=gradeOf(ev,r.raw_score,p)
  hist[g]=(hist[g]||0)+1
  console.log('   '+(p.display_name||'?').slice(0,16).padEnd(17),band(p).padEnd(8),(sex(p)||'?')+'  ',
   r.score_label.padEnd(28), g<0?'— below —':G[g]+' ('+PCT[g]+')')}
 console.log('   spread: '+Object.entries(hist).sort((a,b)=>a[0]-b[0])
   .map(([g,n])=>(g<0?'below':G[g])+'×'+n).join(', '))
}
