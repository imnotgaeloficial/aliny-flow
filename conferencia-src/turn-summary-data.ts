export type SummaryRow={id:string;kind:'machine'|'occurrence';payload:Record<string,string>;updatedAt:string};
export type TurnTotals={machines:number;validated:number;pending:number;divergences:number;occurrences:number;open:number;resolved:number;orders:number};
function count(rows:SummaryRow[]):TurnTotals{
 const machines=rows.filter(r=>r.kind==='machine'),occurrences=rows.filter(r=>r.kind==='occurrence');
 return {machines:machines.length,validated:machines.filter(r=>r.payload.status==='Validada').length,pending:machines.filter(r=>r.payload.status==='Pendente').length,divergences:machines.filter(r=>r.payload.status==='Divergência').length,occurrences:occurrences.length,open:occurrences.filter(r=>r.payload.status!=='Resolvida').length,resolved:occurrences.filter(r=>r.payload.status==='Resolvida').length,orders:new Set(rows.map(r=>r.payload.order?.trim()).filter(Boolean)).size};
}
export function summarizeTurn(rows:SummaryRow[],date:string,operator:string){
 const selected=rows.filter(r=>r.payload.date===date&&(!operator||r.payload.operator===operator));
 const names=[...new Set(selected.map(r=>r.payload.operator||'Não informado'))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 return {rows:selected,totals:count(selected),operators:names.map(name=>({name,...count(selected.filter(r=>(r.payload.operator||'Não informado')===name))}))};
}
