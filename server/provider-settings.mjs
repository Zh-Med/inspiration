// Credentials are configured outside this project through an independent service's
// administrator interface. This process never reads, writes or returns API keys.
export function createProviderSettings(){
 return async(req,res,url)=>{
 if(url.pathname!=='/api/settings/deepseek')return false;
 res.writeHead(req.method==='GET'?200:409,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 if(req.method==='GET')res.end(JSON.stringify({configured:false,model:'',configurationMode:'external-admin',status:'not-connected'}));
 else {req.resume?.();res.end(JSON.stringify({error:'本机密钥配置已关闭，请在独立服务的管理端配置。'}))}
 return true;
 };
}
