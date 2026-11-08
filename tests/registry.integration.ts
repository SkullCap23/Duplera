import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {Contract,ContractFactory,JsonRpcProvider,Wallet,hexlify,randomBytes} from "ethers";
import {attestationTypes,registryDomain} from "@duplera/domain";
const provider=new JsonRpcProvider("http://127.0.0.1:8545",undefined,{cacheTimeout:-1});
const bytes=()=>hexlify(randomBytes(32));
test("registry adversarial lifecycle",async t=>{
  assert.equal(Number((await provider.getNetwork()).chainId),31337,"Integration tests only run against the local chain");
  const artifact=JSON.parse(await readFile("artifacts/InvoiceRegistry.json","utf8"));
  const admin=await provider.getSigner(0),a=await provider.getSigner(1),b=await provider.getSigner(2),outsider=await provider.getSigner(5),oracle=Wallet.createRandom();
  const contract=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,admin).deploy(await admin.getAddress(),oracle.address);await contract.waitForDeployment();
  const registry=new Contract(await contract.getAddress(),artifact.abi,admin);
  const aa=await a.getAddress(),bb=await b.getAddress();
  await(await registry.grantLender(aa)).wait();await(await registry.grantLender(bb)).wait();
  const domain=registryDomain(31337,await registry.getAddress());
  async function approval(lender=aa,token=bytes(),domainOverride=domain){
    const block=await provider.getBlock("latest");
    const payload={schemaVersion:1,matchingToken:token,evidenceRoot:bytes(),lenderAddress:lender,evidenceContext:bytes(),analysisId:bytes(),attestationNonce:bytes(),validUntil:block!.timestamp+300};
    return {payload,signature:await oracle.signTypedData(domainOverride,attestationTypes,payload)};
  }
  const connect=(who:any)=>registry.connect(who) as Contract;
  const reserve=async(ap:Awaited<ReturnType<typeof approval>>,who=a)=>await(await connect(who).reserve(ap.payload,ap.signature,{gasLimit:1000000})).wait();
  let gas:Record<string,string>={};
  await t.test("outsiders and random unsigned tokens rejected",async()=>{const ap=await approval();await assert.rejects(reserve(ap,outsider));await assert.rejects(reserve({...ap,signature:"0x"}));assert.equal(await registry.claimCount(),0n)});
  await t.test("copied approvals and altered fields rejected",async()=>{const ap=await approval();await assert.rejects(reserve(ap,b));for(const key of ["matchingToken","evidenceRoot","evidenceContext","analysisId","attestationNonce"]){await assert.rejects(reserve({...ap,payload:{...ap.payload,[key]:bytes()}}));}await assert.rejects(reserve({...ap,payload:{...ap.payload,schemaVersion:2}}));await assert.rejects(reserve({...ap,payload:{...ap.payload,validUntil:ap.payload.validUntil+1}}));});
  await t.test("cross-chain and cross-contract replay rejected",async()=>{await assert.rejects(reserve(await approval(aa,bytes(),{...domain,chainId:80002})));await assert.rejects(reserve(await approval(aa,bytes(),{...domain,verifyingContract:Wallet.createRandom().address})));});
  const token=bytes(),first=await approval(aa,token);
  await t.test("competing reservations produce exactly one winner",async()=>{const second=await approval(bb,token);const outcomes=await Promise.allSettled([reserve(first),reserve(second,b)]);assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);assert.equal(await registry.claimCount(),1n);const receipt=outcomes.find(x=>x.status==="fulfilled");if(receipt?.status==="fulfilled")gas.reserve=receipt.value!.gasUsed.toString();});
  const id=await registry.currentClaim(token),record=await registry.getClaim(id),owner=record.lender===aa?a:b,other=record.lender===aa?b:a;
  await t.test("only recorded lender confirms or cancels",async()=>{await assert.rejects(async()=>await(await connect(other).confirmFinancing(id,{gasLimit:300000})).wait());await assert.rejects(async()=>await(await connect(other).cancelReservation(id,{gasLimit:300000})).wait());gas.confirm=(await(await connect(owner).confirmFinancing(id)).wait())!.gasUsed.toString();assert.equal(await registry.getEffectiveStatus(id),2n)});
  await t.test("financed claims never time out or permit admin release",async()=>{await provider.send("evm_increaseTime",[1000]);await provider.send("evm_mine",[]);assert.equal(await registry.getEffectiveStatus(id),2n);await assert.rejects(reserve(await approval(aa,token)));await assert.rejects(async()=>await(await registry.releaseFinancing(id,{gasLimit:300000})).wait());await assert.rejects(async()=>await(await connect(other).releaseFinancing(id,{gasLimit:300000})).wait());});
  await t.test("release preserves history and consumed approvals cannot reopen",async()=>{gas.release=(await(await connect(owner).releaseFinancing(id)).wait())!.gasUsed.toString();assert.equal((await registry.getClaim(id)).state,5n);const used=record.lender===aa?first:undefined;if(used)await assert.rejects(reserve(used));await reserve(await approval(aa,token));assert.notEqual(await registry.currentClaim(token),id);assert.equal((await registry.getClaim(id)).evidenceRoot,record.evidenceRoot);});
  await t.test("deadline boundary rejects confirmation and replacement atomically expires history",async()=>{const oldId=await registry.currentClaim(token),old=await registry.getClaim(oldId);await provider.send("evm_setNextBlockTimestamp",[Number(old.reservationDeadline)]);await provider.send("evm_mine",[]);assert.equal(await registry.getEffectiveStatus(oldId),4n);await assert.rejects(async()=>await(await connect(a).confirmFinancing(oldId,{gasLimit:300000})).wait());await reserve(await approval(bb,token),b);assert.equal((await registry.getClaim(oldId)).state,4n);});
  await t.test("revocation blocks new work but permits cleanup",async()=>{const token2=bytes();await reserve(await approval(aa,token2));const cid=await registry.currentClaim(token2);await(await registry.revokeLender(aa)).wait();await assert.rejects(async()=>await(await connect(a).confirmFinancing(cid,{gasLimit:300000})).wait());await assert.rejects(reserve(await approval()));await(await connect(a).cancelReservation(cid)).wait();assert.equal(await registry.getEffectiveStatus(cid),3n);const bid=await registry.currentClaim(token);await(await connect(b).confirmFinancing(bid)).wait();await(await registry.revokeLender(bb)).wait();await(await connect(b).releaseFinancing(bid)).wait();assert.equal(await registry.getEffectiveStatus(bid),5n);});
  console.log("Measured local gas:",gas);
});

