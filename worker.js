export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. 处理 API 请求 (/short)
    if (url.pathname === '/short') {
      return handleRequest(request, env);
    }

    // 2. 尝试从 Assets (静态资源) 获取文件 (如 index.html, favicon.ico 等)
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    } catch (e) {
      // 忽略错误
    }

    // 3. 短链接跳转
    return handleRedirect(request, env);
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  let targetUrl, customSuffix;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // 检查 KV 是否绑定 (直接使用网页端绑定的环境变量)
  if (!env.LINKS) {
    return new Response(JSON.stringify({
      Code: 500,
      Message: '错误：未检测到 KV 绑定 "LINKS"。请在 Cloudflare 后台设置中绑定。'
    }), { status: 200, headers: corsHeaders });
  }

  if (request.method === 'GET') {
    targetUrl = url.searchParams.get('longUrl');
    customSuffix = url.searchParams.get('shortKey');
  } else if (request.method === 'POST') {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        const body = await request.json().catch(()=>({}));
        targetUrl = body.longUrl;
        customSuffix = body.shortKey;
    } else {
        const formData = await request.formData();
        targetUrl = formData.get('longUrl');
        customSuffix = formData.get('shortKey');
    }
  }

  if (!targetUrl) return new Response(JSON.stringify({ Code: 201, Message: 'No URL provided' }), { status: 200, headers: corsHeaders });

  try { targetUrl = atob(targetUrl); } catch (e) { return new Response(JSON.stringify({ Code: 201, Message: 'Base64 decode error' }), { status: 200, headers: corsHeaders }); }

  const suffix = customSuffix || Math.random().toString(36).substring(2, 9);
  const host = request.headers.get("host");
  
  const existing = await env.LINKS.get(suffix);
  if (existing) return new Response(JSON.stringify({ Code: 201, Message: 'Short key exists' }), { status: 200, headers: corsHeaders });

  await env.LINKS.put(suffix, targetUrl);
  
  return new Response(JSON.stringify({
    Code: 1, Message: "Success", ShortUrl: `https://${host}/${suffix}`, LongUrl: targetUrl, ShortKey: suffix
  }), { status: 200, headers: corsHeaders });
}

async function handleRedirect(request, env) {
  const suffix = new URL(request.url).pathname.slice(1);
  if (!env.LINKS) return new Response('KV Error', { status: 500 });
  
  const target = await env.LINKS.get(suffix);
  return target ? Response.redirect(target, 301) : new Response('Link not found', { status: 404 });
}
