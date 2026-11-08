import type {NextConfig} from "next";
import {resolve} from 'node:path';
const config:NextConfig={serverExternalPackages:["pg"], poweredByHeader:false,distDir:process.env.NODE_ENV==='development'?'.next-dev':'.next',outputFileTracingRoot:resolve(process.cwd(),'../..'),outputFileTracingIncludes:{'/api/**/*':['../../deployments/*.json']}};
export default config;
