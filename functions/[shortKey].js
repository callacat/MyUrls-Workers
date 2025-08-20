// functions/[shortKey].js
export async function onRequest(context) {
  const { request, env, params } = context;
  const kv = env.LINKS;  // 假设你有一个名为 LINKS 的 KV 命名空间

  // 从路径中获取 shortKey（例如 /123456）
  const shortKey = params.shortKey;

  // 从 KV 中获取对应的 long URL
  const longUrl = await kv.get(shortKey);

  if (longUrl) {
    // 如果找到了 long URL，返回 301 重定向
    return Response.redirect(longUrl, 301);
  } else {
    // 如果找不到，返回 404
    return new Response("该短链接已失效 请重新生成 生成后将永久生效", { status: 404 });
    // 未找到 → 回首页并带上标记
    // return Response.redirect(`/?error=notfound`, 302);
  }
}
