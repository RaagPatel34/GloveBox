export const EIA_CA_SOURCE='https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_SCA_DPG&f=W';
export type RegionalPrice={price:number;asOf:string;source:string;kind:'eia';label:string;stale:boolean};
export function parseRegionalPrice(body:unknown,now=new Date()):RegionalPrice{
 const rows=(body as {response?:{data?:{period?:string;value?:string|number;units?:string}[]}})?.response?.data;
 const row=rows?.[0];const price=Number(row?.value);const asOf=row?.period;
 if(!asOf||!/^\d{4}-\d{2}-\d{2}$/.test(asOf)||!Number.isFinite(Date.parse(asOf))||Date.parse(asOf)>now.getTime()+86400000||!Number.isFinite(price)||price<=0||price>30)throw new Error('No usable regional price.');
 return {price,asOf,source:EIA_CA_SOURCE,kind:'eia',label:'California weekly regular gasoline average',stale:now.getTime()-Date.parse(asOf)>14*86400000};
}
