import {test} from 'node:test';import assert from 'node:assert/strict';
import {Pool} from 'pg';import {readFile} from 'node:fs/promises';
import {JsonRpcProvider,ContractFactory,Contract,Wallet,randomBytes,hexlify} from 'ethers';
import {replayEvents} from '../packages/domain/src/projection';import {attestationTypes,registryDomain} from '@duplera/domain';
test('event replay recovers missing/repeated/corrupt events and removes reorganised history',async()=>{
 const db=new Pool({connectionString:process.env.DATABASE_URL??'postgres://duplera:duplera@localhost:5432/duplera'}),provider=new JsonRpcProvider('http://127.0.0.1:8545',undefined,{cacheTimeout:-1});
 try{
  assert.equal(Number((await provider.getNetwork()).chainId),31337);
  const artifact=JSON.parse(await readFile('artifacts/InvoiceRegistry.json','utf8')),admin=await provider.getSigner(0),lender=await provider.getSigner(1),oracle=Wallet.createRandom();
  const deployed=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,admin).deploy(await admin.getAddress(),oracle.address);const receipt=await deployed.deploymentTransaction()!.wait();
  const d={chainId:31337,address:await deployed.getAddress(),blockNumber:receipt!.blockNumber,abi:artifact.abi},registry=new Contract(d.address,d.abi,admin);
  await(await registry.grantLender(await lender.getAddress())).wait();const snapshot=await provider.send('evm_snapshot',[]),bytes=()=>hexlify(randomBytes(32)),block=await provider.getBlock('latest');
  const a={schemaVersion:1,matchingToken:bytes(),evidenceRoot:bytes(),lenderAddress:await lender.getAddress(),evidenceContext:bytes(),analysisId:bytes(),attestationNonce:bytes(),validUntil:block!.timestamp+300};
  await(await (registry.connect(lender) as Contract).reserve(a,await oracle.signTypedData(registryDomain(31337,d.address),attestationTypes,a))).wait();
  await replayEvents(db,provider,d);const count=async()=>Number((await db.query("SELECT count(*) FROM chain_events WHERE registry=$1 AND event_name='ClaimReserved'",[d.address.toLowerCase()])).rows[0].count);
  assert.equal(await count(),1);await replayEvents(db,provider,d);assert.equal(await count(),1);
  await db.query("DELETE FROM chain_events WHERE registry=$1 AND event_name='ClaimReserved'",[d.address.toLowerCase()]);await replayEvents(db,provider,d);assert.equal(await count(),1);
  await db.query("UPDATE chain_events SET payload='[]'::jsonb WHERE registry=$1 AND event_name='ClaimReserved'",[d.address.toLowerCase()]);await replayEvents(db,provider,d);
  assert.notDeepEqual((await db.query("SELECT payload FROM chain_events WHERE registry=$1 AND event_name='ClaimReserved'",[d.address.toLowerCase()])).rows[0].payload,[]);
  await provider.send('evm_revert',[snapshot]);await provider.send('evm_mine',[]);await replayEvents(db,provider,d);assert.equal(await count(),0);assert.equal(await registry.claimCount(),0n);
 }finally{await db.end();provider.destroy()}
});
