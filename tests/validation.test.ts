import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePage, requestSchema, issueSchema } from '../src/lib/validation';

test('pagination rejects malformed and nonpositive pages and caps extreme offsets',()=>{for(const value of ['-1','0','NaN','1.5','Infinity'])assert.equal(parsePage(value),1);assert.equal(parsePage(null),1);assert.equal(parsePage('4'),4);assert.equal(parsePage('999999999'),100000);});
test('membership applications require a city even when contact details are valid',()=>{const body={kind:'membership',name:'Test Member',email:'member@example.com',phone:'9876543210',message:'I would like to volunteer.'};assert.equal(requestSchema.safeParse(body).success,false);assert.equal(requestSchema.safeParse({...body,city:'Silvassa'}).success,true);});
test('issuing the same book twice in one request is rejected',()=>{const id='f4a25a6c-89ad-4b73-b95d-514c12d3728f';assert.equal(issueSchema.safeParse({person_id:id,book_ids:[id,id],due_date:'2026-12-01'}).success,false);});

test('contact enquiries allow an empty phone only with one of the five public topics',()=>{const body={kind:'contact',name:'Contact Test',email:'contact@example.test',phone:'',message:'I would like to donate books.',subject:'Donate essentials'};assert.equal(requestSchema.safeParse(body).success,true);assert.equal(requestSchema.safeParse({...body,subject:'Made up topic'}).success,false);assert.equal(requestSchema.safeParse({...body,phone:'invalid'}).success,false);assert.equal(requestSchema.safeParse({...body,kind:'membership',city:'Silvassa'}).success,false)});

test('sameOrigin rejects cross-site browser requests and accepts same-origin or non-browser ones', async () => {
  const {sameOrigin} = await import('../src/lib/validation');
  const req = (headers: Record<string, string>) => new Request('https://trust.example/api/x', {method: 'POST', headers});
  assert.equal(sameOrigin(req({})), true);
  assert.equal(sameOrigin(req({origin: 'https://trust.example'})), true);
  assert.equal(sameOrigin(req({origin: 'https://evil.example'})), false);
  assert.equal(sameOrigin(req({'sec-fetch-site': 'cross-site'})), false);
  assert.equal(sameOrigin(req({'sec-fetch-site': 'same-site'})), false);
  assert.equal(sameOrigin(req({'sec-fetch-site': 'same-origin', origin: 'https://trust.example'})), true);
});

test('staff access bodies need a valid email, name and role', async () => {
  const {staffAccessSchema} = await import('../src/lib/validation');
  assert.equal(staffAccessSchema.safeParse({email: 'a@b.co', name: 'Asha', role: 'viewer'}).success, true);
  assert.equal(staffAccessSchema.safeParse({email: 'nope', name: 'Asha', role: 'viewer'}).success, false);
  assert.equal(staffAccessSchema.safeParse({email: 'a@b.co', name: 'Asha', role: 'root'}).success, false);
  assert.equal(staffAccessSchema.safeParse({email: 'a@b.co', name: '', role: 'admin'}).success, false);
});
