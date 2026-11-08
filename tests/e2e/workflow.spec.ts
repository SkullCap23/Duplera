import {test,expect,request as playwrightRequest} from "@playwright/test";
import {HDNodeWallet,JsonRpcProvider,Contract,getBytes} from "ethers";
import {randomUUID} from "node:crypto";
import {resolve} from "node:path";
import {Pool} from "pg";
import {mkdir,writeFile} from 'node:fs/promises';
const mnemonic="test test test test test test test test test test test junk";
const wallet=(i:number)=>HDNodeWallet.fromPhrase(mnemonic,undefined,`m/44'/60'/0'/0/${i}`);
const rpc=new JsonRpcProvider("http://127.0.0.1:8545",undefined,{cacheTimeout:-1});
test.afterAll(()=>rpc.destroy());
const origin=process.env.TEST_BASE_URL??"http://localhost:3001";
const base={supplierCountry:"IN",supplierIdentifierType:"SYNTHETIC_TAX_ID",supplierIdentifier:"SYN-SUP-001",supplierName:"Synthetic Supplier",buyerIdentifier:"SYN-BUY-021",buyerName:"Synthetic Buyer",invoiceNumberNamespace:"E2E",invoiceNumber:`E2E-${Date.now()}`,invoiceDate:"2026-10-20",currency:"INR",amountMinor:"24850000",description:"Cotton fabric 500 rolls"};
async function session(index:number){const ctx=await playwrightRequest.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}}),w=wallet(index);const challenge=await ctx.post("/api/auth/challenge",{data:{wallet:w.address}});expect(challenge.ok(),await challenge.text()).toBeTruthy();const c=await challenge.json();const r=await ctx.post("/api/auth/verify",{data:{id:c.id,signature:await w.signMessage(c.message)}});expect(r.ok(),await r.text()).toBeTruthy();return ctx;}
test("private API lifecycle, conflict protection and independent disclosure",async()=>{
 const a=await session(1),b=await session(2);const config=await(await a.get("/api/config")).json();
 const submission=await(await a.post("/api/submissions",{data:{invoice:base,pdfDigest:"a".repeat(64),idempotencyKey:randomUUID()}})).json();expect(submission.id).toBeTruthy();
 const forbidden=await b.post(`/api/submissions/${submission.id}/analyse`,{data:{}});expect(forbidden.status()).toBe(404);
 const analysis=await(await a.post(`/api/submissions/${submission.id}/analyse`,{data:{}})).json();expect(analysis.status).not.toBe("ACTIVE_CONFLICT");
 if(analysis.status==="REVIEW_REQUIRED")expect((await a.post(`/api/analyses/${analysis.id}/review`,{data:{disposition:"Synthetic test invoice is distinct; approved for this isolated test."}})).ok()).toBeTruthy();
 const approvalBody={analysisId:analysis.id,idempotencyKey:randomUUID()};
 // An idle local chain may have a future test clock. Pending time must govern approval expiry.
 await rpc.send('evm_increaseTime',[360]);
 const approvals=await Promise.all([a.post(`/api/submissions/${submission.id}/attest`,{data:approvalBody}),a.post(`/api/submissions/${submission.id}/attest`,{data:approvalBody})]);
 const approval=await approvals[0].json();expect(approval.signature).toBeTruthy();expect(await approvals[1].json()).toEqual(approval);
 const c=new Contract(config.address,config.abi,wallet(1).connect(rpc));const tx=await c.reserve(approval.payload,approval.signature);const receipt=await tx.wait();expect(receipt.status).toBe(1);const claimId=(await c.currentClaim(approval.payload.matchingToken)).toString();
 const tracked=await a.post('/api/transactions',{data:{hash:tx.hash,submissionId:submission.id}});expect(tracked.ok(),await tracked.text()).toBeTruthy();expect((await tracked.json()).status).toBe('CONFIRMED');
 expect((await b.post('/api/transactions',{data:{hash:tx.hash,submissionId:duplicateIdForIsolation()}})).status()).toBe(403);
 await(await c.confirmFinancing(claimId)).wait();expect(Number(await c.getEffectiveStatus(claimId))).toBe(2);
 const details=await a.get('/api/claims/'+claimId);expect(details.ok(),await details.text()).toBeTruthy();expect((await details.json()).metadataConsistent).toBe(true);
 expect((await b.get('/api/claims/'+claimId)).status()).toBe(404);
 const institutions=await(await a.get('/api/institutions')).json();expect(institutions).toHaveLength(3);expect(institutions.every((i:any)=>i.approved&&i.name.includes('Synthetic'))).toBe(true);
 const metadataDb=new Pool({connectionString:process.env.DATABASE_URL??'postgres://duplera:duplera@localhost:5432/duplera'});
 try{
  await metadataDb.query("UPDATE submissions SET original=jsonb_set(original,'{amountMinor}','\"999\"'::jsonb) WHERE id=$1",[submission.id]);
  const changed=await(await a.get('/api/claims/'+claimId)).json();expect(changed.metadataConsistent).toBe(false);expect(changed.effectiveState).toBe(2);
 }finally{await metadataDb.query('UPDATE submissions SET original=$1 WHERE id=$2',[base,submission.id]);await metadataDb.end();}
 const duplicate=await(await b.post("/api/submissions",{data:{invoice:{...base,amountMinor:"123456"},pdfDigest:"b".repeat(64),idempotencyKey:randomUUID()}})).json();
 const conflict=await(await b.post(`/api/submissions/${duplicate.id}/analyse`,{data:{}})).json();expect(conflict.status).toBe("ACTIVE_CONFLICT");
 expect((await b.post(`/api/submissions/${duplicate.id}/attest`,{data:{analysisId:conflict.id,idempotencyKey:randomUUID()}})).status()).toBe(409);
 const evidence=await(await a.post(`/api/submissions/${submission.id}/disclosure`,{data:{claimId,fields:["invoiceNumber","amountMinor"]}})).json();expect(evidence.disclosures).toHaveLength(2);
 await mkdir('.local',{recursive:true});await writeFile('.local/receipt-valid.json',JSON.stringify(evidence));
 expect((await(await a.post("/api/verify",{data:evidence})).json()).valid).toBe(true);
 const fakeBlock=structuredClone(evidence);fakeBlock.blockReference.hash='0x'+'0'.repeat(64);expect((await(await a.post('/api/verify',{data:fakeBlock})).json()).valid).toBe(false);
 const fakeTransaction=structuredClone(evidence);fakeTransaction.transactionHash='0x'+'1'.repeat(64);expect((await(await a.post('/api/verify',{data:fakeTransaction})).json()).valid).toBe(false);
 evidence.disclosures[0].value[3]="TAMPERED";expect((await(await a.post("/api/verify",{data:evidence})).json()).valid).toBe(false);
 await(await c.releaseFinancing(claimId)).wait();expect(Number(await c.getEffectiveStatus(claimId))).toBe(5);
 await a.dispose();await b.dispose();
});
test("browser extracts a PDF, signs a reservation and finances the claim",async({page})=>{
 const w=wallet(3);await page.exposeFunction("testWalletRequest",async({method,params=[]}:{method:string;params:any[]})=>{
  if(method==="eth_requestAccounts"||method==="eth_accounts")return [w.address];
  if(method==="personal_sign")return w.signMessage(getBytes(params[0]));
  return rpc.send(method,params);
 });
 await page.addInitScript(()=>{(window as any).ethereum={request:(req:any)=>(window as any).testWalletRequest(req),on:()=>{},removeListener:()=>{}}});
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/");await expect(page.getByRole("heading",{name:"Finance with clarity."})).toBeVisible();
 await page.getByRole("button",{name:"Connect wallet"}).click();await expect(page.getByRole("status")).toContainText("signature verified");
 await page.locator('input[type="file"]').setInputFiles(resolve("data/synthetic/family-00000-base.pdf"));
 await expect(page.getByRole("status")).toContainText("Text extracted locally",{timeout:30000});
 await page.getByLabel("invoice Number",{exact:true}).fill(`UI-${Date.now()}`);
 await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Analyse invoice"}).click();
 await expect(page.getByRole("status")).toContainText("Analysis complete");
 const review=page.getByPlaceholder("Explain why proceeding is appropriate (at least 20 characters).");if(await review.isVisible())await review.fill("Synthetic generated test has a distinct invoice number and approved scope.");
 await page.getByRole("button",{name:"Reserve with wallet"}).click();await expect(page.getByRole("status")).toContainText("Reservation included",{timeout:30000});
 await page.getByRole("button",{name:"Manage claim"}).click();await page.getByRole("button",{name:"Confirm financing",exact:true}).click();await expect(page.getByRole("status")).toContainText("Financing confirmed");
 await page.reload();await expect(page.getByRole('status')).toContainText('workspace restored',{timeout:30000});
 await expect(page.getByRole('heading',{name:'Saved workspace'})).toBeVisible();
 await expect(page.locator('.history-row').filter({hasText:'CONFIRMED'}).first()).toBeVisible();
 await page.locator('.history-row').filter({hasText:'confirmFinancing'}).first().click();
 await expect(page.getByRole('heading',{name:'Read a claim'})).toBeVisible();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:"docs/results/claim-explorer.png",fullPage:true});
 await page.getByRole("button",{name:"Lender workspace"}).click();await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:"docs/results/workspace.png",fullPage:true});
 expect(errors).toEqual([]);
});
function duplicateIdForIsolation(){return randomUUID()}
test('stale analysis, oversized input, malformed proofs and transaction reorganisation',async()=>{
 const a=await session(1),config=await(await a.get('/api/config')).json();
 const db=new Pool({connectionString:process.env.DATABASE_URL??'postgres://duplera:duplera@localhost:5432/duplera'});
 try{
  const data={invoice:{...base,invoiceNumber:'FAULT-'+Date.now()},pdfDigest:'c'.repeat(64),idempotencyKey:randomUUID()};
  const created=await(await a.post('/api/submissions',{data})).json();expect((await(await a.post('/api/submissions',{data})).json()).id).toBe(created.id);
  expect((await a.post('/api/submissions',{data:{...data,invoice:{...data.invoice,amountMinor:'888'}}})).status()).toBe(409);
  const analysed=await(await a.post('/api/submissions/'+created.id+'/analyse',{data:{}})).json();
  await db.query("UPDATE analyses SET created_at=now()-interval '11 minutes' WHERE id=$1",[analysed.id]);
  expect((await a.post('/api/submissions/'+created.id+'/attest',{data:{analysisId:analysed.id,idempotencyKey:randomUUID()}})).status()).toBe(409);
  expect((await a.post('/api/submissions',{data:{padding:'x'.repeat(31000)}})).status()).toBe(413);
  expect((await a.post('/api/auth/challenge',{data:{wallet:'invalid-address'}})).status()).toBe(400);
  const fresh=await(await a.post('/api/submissions/'+created.id+'/analyse',{data:{}})).json();
  if(fresh.status==='REVIEW_REQUIRED')await a.post('/api/analyses/'+fresh.id+'/review',{data:{disposition:'Isolated fault-injection scenario with an explicitly synthetic invoice.'}});
  const approval=await(await a.post('/api/submissions/'+created.id+'/attest',{data:{analysisId:fresh.id,idempotencyKey:randomUUID()}})).json();
  const snapshot=await rpc.send('evm_snapshot',[]),c=new Contract(config.address,config.abi,await rpc.getSigner(1));
  await rpc.send('evm_setAutomine',[false]);
  const tx=await c.reserve(approval.payload,approval.signature,{gasLimit:1000000});
  const pending=await(await a.post('/api/transactions',{data:{hash:tx.hash,submissionId:created.id}})).json();expect(pending.status).toBe('SUBMITTED');
  await rpc.send('evm_mine',[]);
  const tracked=await(await a.get('/api/transactions/'+tx.hash)).json();expect(tracked.status).toBe('CONFIRMED');
  const failed=await c.reserve(approval.payload,approval.signature,{gasLimit:1000000});
  await a.post('/api/transactions',{data:{hash:failed.hash,submissionId:created.id}});await rpc.send('evm_mine',[]);
  expect((await(await a.get('/api/transactions/'+failed.hash)).json()).status).toBe('FAILED');
  const dropped=await c.reserve(approval.payload,approval.signature,{gasLimit:1000000});
  await a.post('/api/transactions',{data:{hash:dropped.hash,submissionId:created.id}});await rpc.send('hardhat_dropTransaction',[dropped.hash]);
  expect((await(await a.get('/api/transactions/'+dropped.hash)).json()).status).toBe('UNKNOWN');
  await rpc.send('evm_setAutomine',[true]);
  const evidence=await(await a.post('/api/submissions/'+created.id+'/disclosure',{data:{claimId:tracked.claimId,fields:['invoiceNumber']}})).json();
  evidence.disclosures[0].proof=['invalid'];expect((await(await a.post('/api/verify',{data:evidence})).json()).valid).toBe(false);
  await rpc.send('evm_revert',[snapshot]);
  const reconciled=await(await a.get('/api/transactions/'+tx.hash)).json();expect(reconciled.status).toBe('REORGED');expect(reconciled.blockHash).toBeNull();
 }finally{await rpc.send('evm_setAutomine',[true]);await db.end();await a.dispose()}
});
test("origin enforcement, unauthenticated reads and consumed login challenge",async()=>{
 const ctx=await playwrightRequest.newContext({baseURL:origin});
 expect((await ctx.get("/api/submissions")).status()).toBe(401);
 expect((await ctx.post("/api/auth/challenge",{data:{wallet:wallet(2).address}})).status()).toBe(403);
 const authenticated=await playwrightRequest.newContext({baseURL:origin,extraHTTPHeaders:{Origin:origin}});
 const challengeResponse=await authenticated.post("/api/auth/challenge",{data:{wallet:wallet(1).address}});
 expect(challengeResponse.ok(),await challengeResponse.text()).toBeTruthy();
 const challenge=await challengeResponse.json();
 const body={id:challenge.id,signature:await wallet(1).signMessage(challenge.message)};
 expect((await authenticated.post("/api/auth/verify",{data:body})).ok()).toBeTruthy();
 expect((await authenticated.post("/api/auth/verify",{data:body})).status()).toBe(401);
 const savedCookie=(await authenticated.storageState()).cookies.find(c=>c.name==='duplera-session')!;
 expect((await authenticated.post("/api/auth/logout",{data:{}})).ok()).toBeTruthy();
 expect((await authenticated.get("/api/submissions")).status()).toBe(401);
 const replay=await playwrightRequest.newContext({baseURL:origin,extraHTTPHeaders:{Cookie:'duplera-session='+savedCookie.value}});
 expect((await replay.get('/api/submissions')).status()).toBe(401);await replay.dispose();
 await ctx.dispose();await authenticated.dispose();
});
test('analysis rate limit is enforced before expensive matching',async()=>{
 const a=await session(2),db=new Pool({connectionString:process.env.DATABASE_URL??'postgres://duplera:duplera@localhost:5432/duplera'}),owner=wallet(2).address.toLowerCase(),bucket=Math.floor(Date.now()/3600000);
 const previous=await db.query("SELECT used FROM api_limits WHERE scope='analysis' AND subject=$1 AND bucket=$2",[owner,bucket]);
 try{
  const data={invoice:{...base,invoiceNumber:'LIMIT-'+Date.now()},pdfDigest:'d'.repeat(64),idempotencyKey:randomUUID()};const created=await(await a.post('/api/submissions',{data})).json();expect(created.id).toBeTruthy();
  await db.query("INSERT INTO api_limits VALUES('analysis',$1,$2,100) ON CONFLICT(scope,subject,bucket) DO UPDATE SET used=100",[owner,bucket]);
  expect((await a.post('/api/submissions/'+created.id+'/analyse',{data:{}})).status()).toBe(429);
 }finally{
  if(previous.rowCount)await db.query("UPDATE api_limits SET used=$1 WHERE scope='analysis' AND subject=$2 AND bucket=$3",[previous.rows[0].used,owner,bucket]);
  else await db.query("DELETE FROM api_limits WHERE scope='analysis' AND subject=$1 AND bucket=$2",[owner,bucket]);
  await db.end();await a.dispose();
 }
});
