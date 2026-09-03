import fs from 'node:fs';

const path='app/page.tsx';
let s=fs.readFileSync(path,'utf8');

const reps=[
  [
    '<strong>{period.openDate} ~ {period.dueDate}{koreanHolidayName(period.dueDate)&&<em style={{display:"block",marginTop:4,fontStyle:"normal",fontSize:12,fontWeight:700,color:"#c94b4b"}}>{koreanHolidayName(period.dueDate)}</em>}</strong>',
    '<strong style={koreanHolidayName(period.dueDate)?{color:"#d32f2f"}:undefined}>{period.openDate} ~ {period.dueDate}{koreanHolidayName(period.dueDate)&&<em style={{display:"block",marginTop:4,fontStyle:"normal",fontSize:12,fontWeight:700,color:"#d32f2f"}}>{koreanHolidayName(period.dueDate)}</em>}</strong>'
  ],
  [
    '<strong>{period.reviewDate}{koreanHolidayName(period.reviewDate)&&<em style={{display:"block",marginTop:4,fontStyle:"normal",fontSize:12,fontWeight:700,color:"#c94b4b"}}>{koreanHolidayName(period.reviewDate)}</em>}</strong>',
    '<strong style={koreanHolidayName(period.reviewDate)?{color:"#d32f2f"}:undefined}>{period.reviewDate}{koreanHolidayName(period.reviewDate)&&<em style={{display:"block",marginTop:4,fontStyle:"normal",fontSize:12,fontWeight:700,color:"#d32f2f"}}>{koreanHolidayName(period.reviewDate)}</em>}</strong>'
  ],
  [
    '<strong>{request.dueDate}{koreanHolidayName(request.dueDate)&&<em style={{display:"block",marginTop:4,fontStyle:"normal",fontSize:12,fontWeight:700,color:"#c94b4b"}}>{koreanHolidayName(request.dueDate)}</em>}</strong>',
    '<strong style={koreanHolidayName(request.dueDate)?{color:"#d32f2f"}:undefined}>{request.dueDate}{koreanHolidayName(request.dueDate)&&<em style={{display:"block",marginTop:4,fontStyle:"normal",fontSize:12,fontWeight:700,color:"#d32f2f"}}>{koreanHolidayName(request.dueDate)}</em>}</strong>'
  ]
];

let changed=0;
for(const [from,to] of reps){
  if(s.includes(from)){
    s=s.replaceAll(from,to);
    changed++;
  }
}
if(!changed) throw new Error('holiday date anchors not found');
fs.writeFileSync(path,s,'utf8');
console.log(`Holiday date red patch applied: ${changed}`);
