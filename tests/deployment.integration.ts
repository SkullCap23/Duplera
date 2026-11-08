import {test} from 'node:test';import assert from 'node:assert/strict';
import {Wallet,JsonRpcProvider,parseEther} from 'ethers';import {readFile,mkdir} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {deployResumable} from '../packages/domain/src/deployment';
test('deployment resumes the same signed transaction after an interrupted broadcast',async()=>{
 const provider=new JsonRpcProvider('http://127.0.0.1:8545',undefined,{cacheTimeout:-1});
 try{
  assert.equal(Number((await provider.getNetwork()).chainId),31337);
  const admin=Wallet.createRandom(),oracle=Wallet.createRandom(),lenders=[Wallet.createRandom().address,Wallet.createRandom().address,Wallet.createRandom().address];
  const faucet=await provider.getSigner(0);await(await faucet.sendTransaction({to:admin.address,value:parseEther('1')})).wait();
  const path='.local/deployment-test-'+randomUUID();await mkdir(path,{recursive:true});
  const options={chainId:31337,admin:new Wallet(admin.privateKey),analysisSigner:oracle.address,lenders,provider,artifact:JSON.parse(await readFile('artifacts/InvoiceRegistry.json','utf8')),journalPath:path+'/journal.json',outputPath:path+'/deployment.json',confirmations:1};
  await assert.rejects(deployResumable({...options,afterBroadcast:async stage=>{if(stage==='deploy')throw new Error('Simulated process interruption')}}),/Simulated/);
  const interrupted=JSON.parse(await readFile(options.journalPath,'utf8'));
  const result=await deployResumable(options);assert.equal(result.transactionHash,interrupted.stages.deploy.hash);
  const count=await provider.getTransactionCount(admin.address);const again=await deployResumable(options);
  assert.equal(again.address,result.address);assert.equal(await provider.getTransactionCount(admin.address),count);
  assert.equal(Object.keys(JSON.parse(await readFile(options.journalPath,'utf8')).stages).length,4);
  await assert.rejects(deployResumable({...options,analysisSigner:Wallet.createRandom().address}),/configuration mismatch/);
 }finally{provider.destroy()}
});
