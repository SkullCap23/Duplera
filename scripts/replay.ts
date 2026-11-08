import {Pool} from "pg";
import {JsonRpcProvider} from "ethers";
import {readFile} from "node:fs/promises";
import {replayEvents} from '../packages/domain/src/projection';
const d=JSON.parse(await readFile(process.env.DEPLOYMENT_FILE??"deployments/local.json","utf8"));
const provider=new JsonRpcProvider(process.env.RPC_URL??"http://127.0.0.1:8545",undefined,{cacheTimeout:-1}),db=new Pool({connectionString:process.env.DATABASE_URL??"postgres://duplera:duplera@localhost:5432/duplera"});
try{
 console.log(await replayEvents(db,provider,d,process.argv[2]?Number(process.argv[2]):undefined));
}finally{await db.end();provider.destroy()}
