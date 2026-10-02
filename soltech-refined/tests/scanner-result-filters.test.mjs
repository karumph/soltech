import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultResultFilters,cleanResultFilters,resultFilterErrors,resultFilterCount} from '../dist/scanner-result-filters.js';

const keys=['capMin','capMax','ageMin','ageMax','liquidityMin','volumeMin'];

test('all shared limits are optional and defaults are independent',()=>{
 const filters=defaultResultFilters();
 assert.deepEqual(Object.keys(filters),keys);
 assert.ok(Object.values(filters).every(value=>value===''));
 assert.deepEqual(resultFilterErrors(filters),{});
 assert.equal(resultFilterCount(filters),0);
 filters.capMin='100';
 assert.equal(defaultResultFilters().capMin,'');
});

test('cleaning accepts partial numeric data without mutating or copying legacy source settings',()=>{
 const input={capMin:0,capMax:100000,ageMax:'24',liquidityMin:'500.50',volumeMin:'5000',activityMin:'999',sources:{public:{enabled:true}}};
 const before=structuredClone(input);
 assert.deepEqual(cleanResultFilters(input),{capMin:'0',capMax:'100000',ageMin:'',ageMax:'24',liquidityMin:'500.50',volumeMin:'5000'});
 assert.deepEqual(input,before);
 for(const value of [undefined,null,false,7,'100',[]])assert.deepEqual(cleanResultFilters(value),defaultResultFilters());
 assert.deepEqual(cleanResultFilters({ageMax:null,capMin:{value:5},volumeMin:true}),defaultResultFilters());
});

test('invalid typed values survive cleanup and remain correctable',()=>{
 for(const input of ['nope','1,000',' 5 ','1e4','+4','0x10','12px','2.',' ', '9'.repeat(400)]){
  const filters=cleanResultFilters({capMin:input});
  assert.equal(filters.capMin,input);
  assert.equal(resultFilterErrors(filters).capMin,'Enter a valid number.');
  assert.equal(resultFilterCount(filters),1);
 }
});

test('every field rejects negative or non-finite numbers and accepts finite decimals and zero',()=>{
 for(const key of keys){
  for(const value of ['0',0,'0.0','0.25','500','500.25'])assert.deepEqual(resultFilterErrors({[key]:value}),{});
  assert.equal(resultFilterErrors({[key]:'-0.5'})[key],'Use zero or a positive number.');
  for(const value of ['Infinity','-Infinity','NaN',Infinity,-Infinity,NaN]){
   assert.equal(cleanResultFilters({[key]:value})[key],String(value));
   assert.equal(resultFilterErrors({[key]:value})[key],'Enter a valid number.');
  }
 }
});

test('range errors attach to the maximum and compare numeric values',()=>{
 for(const [min,max] of [['capMin','capMax'],['ageMin','ageMax']]){
  assert.deepEqual(resultFilterErrors({[min]:'9',[max]:'10'}),{});
  assert.deepEqual(resultFilterErrors({[min]:'0',[max]:'0'}),{});
  assert.deepEqual(resultFilterErrors({[min]:'10',[max]:'10'}),{});
  assert.deepEqual(resultFilterErrors({[min]:'10',[max]:'9'}),{[max]:'Maximum must be at least the minimum.'});
  assert.deepEqual(resultFilterErrors({[min]:'10',[max]:''}),{});
  assert.deepEqual(resultFilterErrors({[min]:'',[max]:'9'}),{});
  assert.deepEqual(resultFilterErrors({[min]:'oops',[max]:'9'}),{[min]:'Enter a valid number.'});
  assert.deepEqual(resultFilterErrors({[min]:'10',[max]:'-1'}),{[max]:'Use zero or a positive number.'});
 }
});

test('filter count counts four groups, includes zero and ignores legacy hidden limits',()=>{
 assert.equal(resultFilterCount({}),0);
 assert.equal(resultFilterCount({capMin:'0'}),1);
 assert.equal(resultFilterCount({capMin:'0',capMax:'100'}),1);
 assert.equal(resultFilterCount({capMax:0,ageMax:'0',liquidityMin:'0',volumeMin:0}),4);
 assert.equal(resultFilterCount({capMin:'',capMax:'',ageMin:'',ageMax:'',liquidityMin:'',volumeMin:'',activityMin:'50',reserveMin:'100',holdersMin:'99'}),0);
 assert.equal(resultFilterCount({ageMin:'2',ageMax:'4'}),1);
});
