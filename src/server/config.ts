import { z } from 'zod';
export function config(){
 const c=z.object({appUrl:z.string().url(),amount:z.coerce.number().int().min(50).max(100000),maxUpload:z.coerce.number().int().min(1).max(25),ttl:z.coerce.number().int().min(45).max(59)}).parse({appUrl:process.env.APP_URL??'http://localhost:3000',amount:process.env.STRIPE_PRICE_AMOUNT??499,maxUpload:process.env.MAX_UPLOAD_MB??25,ttl:process.env.FILE_TTL_MINUTES??59});
 return {...c,mock:process.env.NODE_ENV!=='production'&&process.env.PAYMENT_MODE==='mock',storeDir:process.env.TEMP_STORE_DIR??'.feedfix',secret:process.env.STRIPE_SECRET_KEY,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET};
}
