import {test} from 'node:test';import assert from 'node:assert/strict';
import {factSelectionSchema,parseFactSelection,groundedSelection,type Fact} from '../packages/domain/src/agent';

const facts:Fact[]=[{id:'financing-state',statement:'An active FINANCED claim blocks a new reservation.',sourceId:'chain:test',critical:true},{id:'supplier-issuance',statement:'Verified supplier issuance has not been established.',sourceId:'lineage:test',critical:true},{id:'analysis-snapshot',statement:'Historical snapshot.',sourceId:'analysis:test'}];
test('final response schema permits only verified fact IDs and parser still rejects unsupported content',()=>{
 assert.deepEqual(factSelectionSchema(facts).properties.selectedFactIds.items.enum,facts.map(f=>f.id));
 for(const text of ['Here is the report: {}','{"selectedFactIds":["invented"]}','{"selectedFactIds":[{"id":"financing-state"}]}','{"selectedFactIds":[],"claim":"No conflict"}','{"selectedFactIds":null}'])assert.throws(()=>parseFactSelection(text,facts));
 assert.equal(groundedSelection(facts,parseFactSelection('{"selectedFactIds":[]}',facts)).filter(f=>f.critical).length,2);
});
