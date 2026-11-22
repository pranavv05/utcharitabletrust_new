import test from 'node:test';
import assert from 'node:assert/strict';
import {trustDate,renewalMin,clampRecordPage} from '../src/lib/admin/dates';
import {authRequestSchema} from '../src/lib/admin/auth-validation';
test('book-bank calendar switches at midnight in India, independently of server timezone',()=>{assert.equal(trustDate(new Date('2026-11-21T18:29:59Z')),'2026-11-21');assert.equal(trustDate(new Date('2026-11-21T18:30:00Z')),'2026-11-22')});
test('renewal dates survive missing historical due dates and handle month boundaries',()=>{const now=new Date('2026-11-21T20:00:00Z');for(const v of [null,undefined,'bad date',''])assert.equal(renewalMin(v,now),'2026-11-22');assert.equal(renewalMin('2026-11-20',now),'2026-11-22');assert.equal(renewalMin('2026-11-30',now),'2026-12-01');assert.equal(renewalMin('2028-02-28',now),'2028-02-29')});
test('record pages recover when the last record on a page is removed',()=>{assert.equal(clampRecordPage(3,50),2);assert.equal(clampRecordPage(2,25),1);assert.equal(clampRecordPage(2,26),2);assert.equal(clampRecordPage(10,0),1)});
test('malformed login payloads fail validation instead of dereferencing null',()=>{for(const value of [null,[],42,'login',{action:'unknown'},{email:[]}])assert.equal(authRequestSchema.safeParse(value).success,false);assert.equal(authRequestSchema.safeParse({email:'admin@example.test',password:'test-only-placeholder'}).success,true);assert.equal(authRequestSchema.safeParse({action:'logout'}).success,true)});
