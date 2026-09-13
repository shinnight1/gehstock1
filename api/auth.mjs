import { auth } from '../netlify/functions/lib/auth-service.mjs';
export const POST = auth.endpoint;
export const GET = auth.endpoint;
