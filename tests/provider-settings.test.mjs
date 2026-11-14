import test from 'node:test';import assert from 'node:assert/strict';
import {createProviderSettings} from '../server/provider-settings.mjs';
test('local provider endpoint exposes no secrets and rejects key configuration',async()=>{
 const api=createProviderSettings();let status,body;const res={writeHead(code){status=code},end(text){body=JSON.parse(text)}};
 await api({method:'GET'},res,new URL('http://localhost/api/settings/deepseek'));assert.equal(status,200);assert.equal(body.configurationMode,'external-admin');assert.equal(body.configured,false);
 for(const method of ['PUT','POST','DELETE']){await api({method},res,new URL('http://localhost/api/settings/deepseek'));assert.equal(status,409)}
});
