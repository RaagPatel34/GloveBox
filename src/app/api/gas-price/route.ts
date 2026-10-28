import {parseRegionalPrice} from '@/lib/gas-price';
export async function GET(){
 if(!process.env.EIA_API_KEY)return Response.json({error:'Regional price lookup is not connected. Enter an observed price and its date.'},{status:503});
 try{const url=new URL('https://api.eia.gov/v2/petroleum/pri/gnd/data/');url.search=new URLSearchParams({'api_key':process.env.EIA_API_KEY,frequency:'weekly','data[0]':'value','facets[series][]':'EMM_EPMR_PTE_SCA_DPG','sort[0][column]':'period','sort[0][direction]':'desc',length:'1'}).toString();const r=await fetch(url,{signal:AbortSignal.timeout(8000),next:{revalidate:21600}});if(!r.ok)throw new Error();return Response.json(parseRegionalPrice(await r.json()));}catch{return Response.json({error:'Regional prices are unavailable. Enter an observed price instead.'},{status:502});}
}
