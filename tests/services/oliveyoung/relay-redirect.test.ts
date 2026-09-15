import { createServer } from 'node:http';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { requestOliveyoung } from '../../../src/services/oliveyoung/transport.js';
it('리다이렉트된 다른 서버에 Access 비밀을 전달하지 않는다', async () => {
  let received=0;
  const target=createServer((_req,res)=>{received++;res.writeHead(200,{'Content-Type':'application/json'});res.end('{"status":"SUCCESS"}');});
  target.listen(0,'127.0.0.1');await once(target,'listening');
  const targetPort=(target.address() as {port:number}).port;
  const relay=createServer((_req,res)=>{res.writeHead(302,{Location:`http://127.0.0.1:${targetPort}/leak`});res.end();});
  relay.listen(0,'127.0.0.1');await once(relay,'listening');
  try{
    await expect(requestOliveyoung('/p',{}, {relayUrl:`http://127.0.0.1:${(relay.address() as {port:number}).port}`,relayToken:'test-only',accessClientId:'test-id',accessClientSecret:'test-only-secret'})).rejects.toThrow('릴레이 요청 실패');
    expect(received).toBe(0);
  }finally{
    target.closeAllConnections();relay.closeAllConnections();
    await Promise.all([new Promise<void>((resolve)=>target.close(()=>resolve())),new Promise<void>((resolve)=>relay.close(()=>resolve()))]);
  }
});
