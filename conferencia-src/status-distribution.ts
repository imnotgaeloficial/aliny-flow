export type DistributionRow={kind:string;payload:Record<string,string>};
export type DistributionItem={label:string;value:string;count:number;color:string;percent:number;offset:number};
const styles:Record<string,{label:string;color:string}>={
 Validada:{label:'Validadas',color:'#64bea7'},Pendente:{label:'Pendentes',color:'#d9b16e'},'Divergência':{label:'Com divergência',color:'#d98598'},
 Aberta:{label:'Abertas',color:'#d98598'},'Em análise':{label:'Em análise',color:'#d9b16e'},Resolvida:{label:'Resolvidas',color:'#64bea7'},
};
export function statusDistribution(rows:DistributionRow[],kind:string){
 const counts=new Map<string,number>();
 for(const row of rows){if(row.kind!==kind)continue;const value=row.payload.status?.trim()||'';counts.set(value,(counts.get(value)||0)+1)}
 const order=kind==='machine'?['Validada','Pendente','Divergência']:['Resolvida','Em análise','Aberta'];
 const entries=[...counts].sort(([a],[b])=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?order.length:ai)-(bi<0?order.length:bi)||a.localeCompare(b,'pt-BR')});
 const total=entries.reduce((sum,[,count])=>sum+count,0);let offset=0;
 const items:DistributionItem[]=entries.map(([value,count])=>{const percent=count/total*100,style=styles[value]||{label:value||'Sem situação',color:'#a2acbe'};const item={...style,value,count,percent,offset};offset+=percent;return item});
 return {total,items};
}
