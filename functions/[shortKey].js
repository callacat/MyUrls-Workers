// functions/[shortKey].js
export async function onRequest(context) {
  const { env, params } = context;
  const kv = env.LINKS; // 绑定的 KV 命名空间

  const shortKey = params.shortKey;

  // 从 KV 中取出原始长链
  const longUrl = await kv.get(shortKey);

  if (!longUrl) {
    return new Response("该短链接已失效 请重新生成 生成后将永久生效", { status: 404 });
  }

  // ====== 域名黑名单校验（命中则判定内容违规）======
  // 使用“域名后缀匹配”更可靠：a.b.github.io 也会命中 github.io
  const DENY_SUFFIXES = ["cloudfront.net", "github.io"];

  // 尝试解析 URL；若用户存的是裸域或不含协议，补齐 https:// 再解析
  const toURL = (u) => {
    try {
      return new URL(u);
    } catch {
      // 若没有协议，补 https 再试
      return new URL(`https://${u}`);
    }
  };

  let host = "";
  try {
    host = toURL(longUrl).hostname.toLowerCase();
  } catch {
    // 万一仍无法解析，当作命中违规，防止绕过
    return new Response("内容违规：目标地址格式非法", { status: 451 });
  }

  const isDenied = DENY_SUFFIXES.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
  // 兼容旧存量（如果有人把整串当作文本存了），再做一次字符串包含兜底
  const containsDenied = DENY_SUFFIXES.some(suffix => longUrl.toLowerCase().includes(suffix));

  if (isDenied || containsDenied) {
    return new Response("内容违规：目标域名被禁止", { status: 451 });
  }

  // ====== 通过校验，执行 301 跳转 =======
  return Response.redirect(longUrl, 301);
}
