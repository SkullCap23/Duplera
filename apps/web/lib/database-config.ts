import type {PoolConfig} from 'pg';
import {X509Certificate} from 'node:crypto';

export function databaseConfig(connectionString:string|undefined,caBase64:string|undefined):PoolConfig {
 if(!caBase64)return {connectionString};
 if(!connectionString)throw new Error('DATABASE_URL is required with DATABASE_CA_BASE64');
 const ca=Buffer.from(caBase64,'base64').toString('utf8');
 new X509Certificate(ca);
 const url=new URL(connectionString);
 if(url.searchParams.get('sslmode')!=='verify-full')throw new Error('Certificate-configured database requires sslmode=verify-full');
 // pg URL SSL settings override its explicit ssl object; use the verified object exclusively.
 for(const key of ['sslmode','sslrootcert','sslcert','sslkey','ssl','uselibpqcompat'])url.searchParams.delete(key);
 return {connectionString:url.href,ssl:{ca,rejectUnauthorized:true}};
}
