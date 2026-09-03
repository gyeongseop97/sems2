const LUNAR_HOLIDAYS: Record<number,{seol:string;buddha:string;chuseok:string}> = {
  2026:{seol:"2026-02-17",buddha:"2026-05-24",chuseok:"2026-09-25"},
  2027:{seol:"2027-02-07",buddha:"2027-05-13",chuseok:"2027-09-15"},
  2028:{seol:"2028-01-27",buddha:"2028-05-02",chuseok:"2028-10-03"},
  2029:{seol:"2029-02-13",buddha:"2029-05-20",chuseok:"2029-09-22"},
  2030:{seol:"2030-02-03",buddha:"2030-05-09",chuseok:"2030-09-12"},
  2031:{seol:"2031-01-23",buddha:"2031-05-28",chuseok:"2031-10-01"},
  2032:{seol:"2032-02-11",buddha:"2032-05-16",chuseok:"2032-09-19"},
  2033:{seol:"2033-01-31",buddha:"2033-05-06",chuseok:"2033-09-08"},
  2034:{seol:"2034-02-19",buddha:"2034-05-25",chuseok:"2034-09-27"},
  2035:{seol:"2035-02-08",buddha:"2035-05-15",chuseok:"2035-09-16"},
  2036:{seol:"2036-01-28",buddha:"2036-05-03",chuseok:"2036-10-04"},
  2037:{seol:"2037-02-15",buddha:"2037-05-22",chuseok:"2037-09-24"},
  2038:{seol:"2038-02-04",buddha:"2038-05-11",chuseok:"2038-09-13"},
  2039:{seol:"2039-01-24",buddha:"2039-04-30",chuseok:"2039-10-02"},
  2040:{seol:"2040-02-12",buddha:"2040-05-18",chuseok:"2040-09-21"},
  2041:{seol:"2041-02-01",buddha:"2041-05-07",chuseok:"2041-09-10"},
  2042:{seol:"2042-01-22",buddha:"2042-05-26",chuseok:"2042-09-28"},
  2043:{seol:"2043-02-10",buddha:"2043-05-16",chuseok:"2043-09-17"},
  2044:{seol:"2044-01-30",buddha:"2044-05-05",chuseok:"2044-10-05"},
  2045:{seol:"2045-02-17",buddha:"2045-05-24",chuseok:"2045-09-25"},
  2046:{seol:"2046-02-06",buddha:"2046-05-13",chuseok:"2046-09-15"},
  2047:{seol:"2047-01-26",buddha:"2047-05-02",chuseok:"2047-10-04"},
  2048:{seol:"2048-02-14",buddha:"2048-05-20",chuseok:"2048-09-22"},
  2049:{seol:"2049-02-02",buddha:"2049-05-09",chuseok:"2049-09-11"},
  2050:{seol:"2050-01-23",buddha:"2050-05-28",chuseok:"2050-09-30"},
};

const SPECIAL: Record<string,string> = {
  "2026-06-03":"전국동시지방선거",
  "2028-04-12":"국회의원선거",
};

function iso(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function addDays(v:string,n:number){const d=new Date(`${v}T12:00:00`);d.setDate(d.getDate()+n);return iso(d)}
function dow(v:string){return new Date(`${v}T12:00:00`).getDay()}
function add(map:Map<string,string>,date:string,name:string){const old=map.get(date);map.set(date,old&&!old.includes(name)?`${old} · ${name}`:old||name)}
function nextSubstitute(map:Map<string,string>,start:string){let d=addDays(start,1);while(map.has(d)||dow(d)===0)d=addDays(d,1);return d}

export function koreanHolidays(year:number):Map<string,string>{
  const map=new Map<string,string>();
  const fixed:[string,string][]=[
    ["01-01","신정"],["03-01","삼일절"],["05-01","노동절"],["05-05","어린이날"],
    ["06-06","현충일"],["07-17","제헌절"],["08-15","광복절"],["10-03","개천절"],
    ["10-09","한글날"],["12-25","성탄절"],
  ];
  fixed.forEach(([md,name])=>add(map,`${year}-${md}`,name));
  const lunar=LUNAR_HOLIDAYS[year];
  if(lunar){
    add(map,addDays(lunar.seol,-1),"설날 연휴");add(map,lunar.seol,"설날");add(map,addDays(lunar.seol,1),"설날 연휴");
    add(map,lunar.buddha,"부처님오신날");
    add(map,addDays(lunar.chuseok,-1),"추석 연휴");add(map,lunar.chuseok,"추석");add(map,addDays(lunar.chuseok,1),"추석 연휴");

    for(const group of [[addDays(lunar.seol,-1),lunar.seol,addDays(lunar.seol,1)],[addDays(lunar.chuseok,-1),lunar.chuseok,addDays(lunar.chuseok,1)]]){
      if(group.some(d=>dow(d)===0||(map.get(d)||"").includes(" · "))){add(map,nextSubstitute(map,group[2]),"대체공휴일")}
    }

    const substituteTargets=[`${year}-03-01`,`${year}-05-01`,`${year}-05-05`,`${year}-07-17`,`${year}-08-15`,`${year}-10-03`,`${year}-10-09`,`${year}-12-25`,lunar.buddha];
    substituteTargets.forEach(d=>{if(dow(d)===0||dow(d)===6||(map.get(d)||"").includes(" · "))add(map,nextSubstitute(map,d),"대체공휴일")});
  }
  Object.entries(SPECIAL).forEach(([date,name])=>{if(date.startsWith(`${year}-`))add(map,date,name)});
  return map;
}

export function koreanHolidayName(date:string){
  const year=Number(date?.slice(0,4));
  if(!year||year<2026||year>2050)return "";
  return koreanHolidays(year).get(date)||"";
}

export function isKoreanHoliday(date:string){return Boolean(koreanHolidayName(date))}
