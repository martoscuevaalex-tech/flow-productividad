import { createClient } from '@supabase/supabase-js';
import { flowCloud } from './public-config';
const url=import.meta.env.VITE_SUPABASE_URL || flowCloud.url;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY || flowCloud.key;
export const supabaseProjectUrl=url;
export const configured=Boolean(url&&key);
export const supabase=configured?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
