import test from 'node:test';
import assert from 'node:assert/strict';
import {toCsv,csvCell} from '../src/lib/admin/csv';
import {parse} from 'csv-parse/sync';
test('CSV exports preserve commas/newlines and neutralise spreadsheet formulas',()=>{assert.equal(csvCell('  =SUM(A1:A3)'),`"'  =SUM(A1:A3)"`);assert.equal(csvCell('\t@evil'),`"'\t@evil"`);const text=toCsv([{name:'A, B',note:'Line one\n"Line two"',formula:'+1+1'}]);const rows=parse(text,{columns:true,bom:true});assert.deepEqual(rows,[{name:'A, B',note:'Line one\n"Line two"',formula:"'+1+1"}])});
