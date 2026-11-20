import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
test('supplier, investigation and MCP consoles explain their controls without a connected wallet',async({page})=>{
 await page.goto('/');
 for(const [label,heading,file] of [['Supplier issuance','Supplier issuance and amendments','supplier-console'],['Investigation agent','Evidence-grounded investigation','investigation-console'],['MCP connections','MCP connections and audit','mcp-console']]){
  await page.getByRole('button',{name:new RegExp(label)}).click();
  await expect(page.getByRole('heading',{name:heading})).toBeVisible();
  await page.screenshot({path:'docs/results/'+file+'.png',fullPage:true});
 }
});
test('extracts structured item rows from a generated two-page invoice',async({page})=>{
 await page.goto('/');
 await page.locator('input[type="file"]').setInputFiles(resolve('data/synthetic-v2/family-00000-items-reordered.pdf'));
 await expect(page.getByRole('status')).toContainText('Text extracted locally',{timeout:30000});
 const items=JSON.parse(await page.getByLabel('Structured line items (JSON, optional)').inputValue());
 expect(items).toHaveLength(2);expect(items.every((i:any)=>i.code&&i.totalMinor)).toBe(true);
});
