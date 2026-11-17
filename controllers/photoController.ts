import { z } from 'zod';
import { json, parseQuery, route } from '@/models/http';
import { AppError } from '@/models/errors';
import { RULES } from '@/models/ratelimit';
import { findVehiclePhotos } from '@/models/photos/vehicle';
import { fetchMarketImage } from '@/models/photos/marketImage';
import { validMarketImagePath } from '@/models/photos/urls';

const Q=z.object({make:z.string().trim().min(1).max(60),model:z.string().trim().min(1).max(60),year:z.string().regex(/^\d{4}$/),trim:z.string().trim().max(60).optional(),color:z.string().trim().max(24).optional()});
export const GET=route({auth:false,name:'photo.lookup',rateLimit:{...RULES.market,id:'photo',limit:40,windowSec:60}},async({req})=>{const q=parseQuery(req,Q);if(!process.env.MARKETCHECK_API_KEY)throw new AppError(503,'not_configured','Photo service is unavailable.');try{return json(await findVehiclePhotos(q),{headers:{'Cache-Control':'public, max-age=3600, s-maxage=86400'}})}catch(e){throw new AppError(503,'upstream_failed','Photo service is temporarily unavailable.',undefined,{retryAfterSec:60})}});
const IQ=z.object({path:z.string()});
export const imageGET=route({auth:false,name:'photo.image',rateLimit:{...RULES.market,id:'photo-image',limit:120,windowSec:60}},async({req})=>{const {path}=parseQuery(req,IQ);if(!validMarketImagePath(path))throw new AppError(400,'invalid_input','Invalid image path.');try{const r=await fetchMarketImage(path);if(!r.ok)throw new AppError(404,'not_found','Image is unavailable.');return new Response(r.body,{status:200,headers:{'Content-Type':r.headers.get('content-type')||'image/jpeg','Cache-Control':'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000','X-Content-Type-Options':'nosniff'}})}catch(e){if(e instanceof AppError)throw e;throw new AppError(502,'upstream_failed','Image is unavailable.')}});
