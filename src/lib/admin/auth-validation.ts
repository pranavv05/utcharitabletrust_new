import {z} from 'zod';
export const authRequestSchema=z.object({action:z.enum(['login','logout','password']).optional(),email:z.string().max(254).optional(),password:z.string().max(200).optional(),current:z.string().max(200).optional()});
