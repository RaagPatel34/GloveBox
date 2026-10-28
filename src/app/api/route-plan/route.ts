import {boundedJson,sameOrigin} from '@/lib/request-json';
import {validateStops,routeRequest,parseDrivingRoute} from '@/lib/route-planner';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Cross-origin requests are not accepted.'},{status:403});
 if(process.env.ENABLE_MAPS!=='true'||!process.env.GOOGLE_MAPS_API_KEY)return Response.json({error:'Automatic routing is not connected yet. You can still open your stops in Google Maps and enter its distance.'},{status:503});
 let stops:string[],optimize:boolean;
 try{const body=await boundedJson(request) as {stops?:unknown;optimize?:unknown};stops=validateStops(body?.stops);optimize=body?.optimize===true;}catch(e){return Response.json({error:(e as Error).message},{status:400});}
 try{
 const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_MAPS_API_KEY,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration,routes.optimizedIntermediateWaypointIndex'},body:JSON.stringify(routeRequest(stops,optimize)),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error();
 return Response.json(parseDrivingRoute(await response.json(),stops,optimize));
 }catch{return Response.json({error:'Could not calculate a driving route. Check the addresses or use the Google Maps link.'},{status:502});}
}
