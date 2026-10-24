import {boundedJson,sameOrigin} from '@/lib/request-json';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Cross-origin requests are not accepted.'},{status:403});
 if(process.env.ENABLE_MAPS!=='true'||!process.env.GOOGLE_MAPS_API_KEY)return Response.json({error:'Place search is not connected yet. Enter a known address in your stops.'},{status:503});
 let query:string;
 try{const b=await boundedJson(request) as {query?:unknown};if(typeof b?.query!=='string'||b.query.trim().length<3||b.query.length>200)throw new Error('Enter a place and city, up to 200 characters.');query=b.query.trim();}catch(e){return Response.json({error:(e as Error).message},{status:400});}
 try{const r=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.googleMapsUri'},body:JSON.stringify({textQuery:query,regionCode:'US',pageSize:5}),signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error();const d=await r.json();return Response.json({places:(d.places??[]).filter((p:{id?:string;formattedAddress?:string})=>p.id&&p.formattedAddress).map((p:{id:string;displayName?:{text?:string};formattedAddress:string})=>({id:p.id,name:p.displayName?.text??p.formattedAddress,address:p.formattedAddress}))});}catch{return Response.json({error:'Place search is unavailable. Try a more specific name and city.'},{status:502});}
}
