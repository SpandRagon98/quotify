import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,csvText} from '../src/crm/csv.js';
import {mapIncoming} from '../src/crm/adapters.js';
import {activityStatus,formPayload} from '../src/crm/schema.js';
import {periodBounds,customerValues,eligibleOwners,safeDocumentUrl} from '../src/crm/helpers.js';
test('CSV parser preserves quoted commas, line breaks, BOM and escaped quotes',()=>{
 const parsed=parseCsv('\uFEFFname,company_name,notes\r\n"Ada, Smith",Engines,"Line 1\nLine 2 ""quoted"""\r\n');
 assert.deepEqual(parsed.headers,['name','company_name','notes']);assert.equal(parsed.rows[0][2],'Line 1\nLine 2 "quoted"');
 assert.throws(()=>parseCsv('name,name\na,b'),/unique/);assert.throws(()=>parseCsv('name\n"unfinished'),/unfinished/);
});
test('CSV ingestion mapping validates before upload and preserves raw payload',()=>{
 const result=mapIncoming(['Person','Email'],['Ada','ada@example.com'],{name:'Person',email:'Email'});
 assert.equal(result.name,'Ada');assert.equal(result.raw_payload.Person,'Ada');
 assert.throws(()=>mapIncoming(['Person'],['Ada'],{}),/mapped name/);
 assert.throws(()=>mapIncoming(['Person','Email'],['Ada','bad'],{name:'Person',email:'Email'}),/Invalid email/);
 assert.match(csvText([{name:'=IMPORTXML("secret")'}]),/'=IMPORTXML/);
});
test('activities identify overdue immediately without waiting for the scheduler',()=>{
 const now=Date.parse('2026-09-16T12:00Z');
 assert.equal(activityStatus({status:'Pending',due_at:'2026-09-16T11:00Z'},now),'Overdue');
 assert.equal(activityStatus({status:'Completed',due_at:'2026-09-16T11:00Z'},now),'Completed');
});
test('form payload keeps booleans, normalizes tags and UTC dates',()=>{
 const payload=formPayload('activities',{title:'Call',owner_id:'user',activity_type:'Task',status:'Pending',priority:'Normal',tags:'one, two',due_at:'2026-09-16T12:00:00Z'});
 assert.deepEqual(payload.tags,['one','two']);assert.equal(payload.due_at,'2026-09-16T12:00:00.000Z');assert.equal(payload.contact_id,null);
});
test('timeframes use exclusive UTC bounds and customer prefill never infers financial totals',()=>{
 assert.deepEqual(periodBounds('Last month','','',new Date('2026-01-16T00:00Z')),{p_from:'2025-12-01T00:00:00.000Z',p_to:'2026-01-01T00:00:00.000Z'});
 assert.deepEqual(periodBounds('Custom range','2026-09-01','2026-09-16'),{p_from:'2026-09-01T00:00:00.000Z',p_to:'2026-09-17T00:00:00.000Z'});
 assert.equal(customerValues({name:'Company',email:'company@example.com'},{first_name:'Ada',email:'ada@example.com'}).Email,'ada@example.com');
 assert.equal(safeDocumentUrl('javascript:alert(1)'),null);
});
test('owner selector follows own/team eligibility',()=>{
 const members=[{id:'me',team_id:'a'},{id:'teammate',team_id:'a'},{id:'other',team_id:'b'}];
 assert.deepEqual(eligibleOwners({user:{id:'me',role:'sales_manager'},members}).map(m=>m.id),['me','teammate']);
 assert.equal(eligibleOwners({user:{id:'me',role:'sales_user'},members}).length,1);
});
