import {fetchRegionalPrice} from '@/lib/gas-price';
export async function GET(){
 if(!process.env.EIA_API_KEY)return Response.json({error:'Regional price lookup is not connected. Enter an observed price and its date.'},{status:503});
 try{return Response.json(await fetchRegionalPrice(process.env.EIA_API_KEY));}catch{return Response.json({error:'Regional prices are unavailable. Enter an observed price instead.'},{status:502});}
}
