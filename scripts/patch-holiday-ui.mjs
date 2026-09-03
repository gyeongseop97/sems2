import fs from 'node:fs';

const path='app/page.tsx';
let s=fs.readFileSync(path,'utf8');

const importNeedle='import { getSupabaseBrowserClient } from "@/lib/supabase/client";';
const importLine='import { koreanHolidayName } from "@/lib/korean-holidays";';
if(!s.includes(importLine)){
  if(!s.includes(importNeedle)) throw new Error('Supabase import anchor not found');
  s=s.replace(importNeedle,`${importNeedle}\n${importLine}`);
}

const holidayBadge=(expr)=>`{koreanHolidayName(${expr})&&<em style={{display:"block",marginTop:4,fontStyle:"normal",fontSize:12,fontWeight:700,color:"#c94b4b"}}>{koreanHolidayName(${expr})}</em>}`;

const replacements=[
  [
    '<strong>{request.dueDate}</strong>',
    `<strong>{request.dueDate}${holidayBadge('request.dueDate')}</strong>`
  ],
  [
    '<strong>{period.openDate} ~ {period.dueDate}</strong>',
    `<strong>{period.openDate} ~ {period.dueDate}${holidayBadge('period.dueDate')}</strong>`
  ],
  [
    '<strong>{period.reviewDate}</strong>',
    `<strong>{period.reviewDate}${holidayBadge('period.reviewDate')}</strong>`
  ]
];

for(const [from,to] of replacements){
  if(s.includes(from)) s=s.replaceAll(from,to);
}

fs.writeFileSync(path,s,'utf8');
console.log('SEMS2 holiday UI patch applied');
