export async function onRequest(context) {
    const { request, env } = context;
    const kv = env.LINKS;

    // CORS 头部配置
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 
        'Access-Control-Allow-Headers': 'Content-Type', 
        'Content-Type': 'application/json'
    };

    try {
        // 检查 kv 是否有值
        if (!kv) {
            return new Response(JSON.stringify({
                Code: 201,
                Message: '请去Pages控制台-设置 将变量名称设定为“LINKS”并绑定KV命名空间然后重试部署！'
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        const method = request.method;
        let longUrl, shortKey;

        // 处理 OPTIONS 请求
        if (method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        // GET 请求
        if (method === "GET") {
            const url = new URL(request.url);
            longUrl = url.searchParams.get('longUrl');
            shortKey = url.searchParams.get('shortKey');

            if (!longUrl) {
                return new Response(JSON.stringify({
                    Code: 201,
                    Message: "No longUrl provided"
                }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            try {
                longUrl = decodeBase64(longUrl);
            } catch (err) {
                return new Response(JSON.stringify({
                    Code: 201,
                    Message: "Invalid Base64 encoding for longUrl",
                    Error: err.message
                }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            return await handleUrlStorage(kv, longUrl, shortKey);
        }

        // POST 请求
        else if (method === "POST") {
            const formData = await request.formData();
            longUrl = formData.get('longUrl');
            shortKey = formData.get('shortKey');

            if (!longUrl) {
                return new Response(JSON.stringify({
                    Code: 201,
                    Message: "No longUrl provided"
                }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            try {
                longUrl = decodeBase64(longUrl);
            } catch (err) {
                return new Response(JSON.stringify({
                    Code: 201,
                    Message: "Invalid Base64 encoding for longUrl",
                    Error: err.message
                }), {
                    status: 200,
                    headers: corsHeaders
                });
            }

            return await handleUrlStorage(kv, longUrl, shortKey);
        }

        // 其它方法
        return new Response(JSON.stringify({
            Code: 405,
            Message: "Method not allowed"
        }), {
            status: 405,
            headers: corsHeaders
        });

    } catch (err) {
        // 全局捕获
        return new Response(JSON.stringify({
            Code: 500,
            Message: "Worker exception caught",
            Error: err.message || String(err),
            Stack: err.stack || null
        }), {
            status: 500,
            headers: corsHeaders
        });
    }

    /**
     * 存储逻辑
     */
    async function handleUrlStorage(kv, longUrl, shortKey) {
        const blockedDomains = ["cloudfront.net", "github.io"];
        for (const domain of blockedDomains) {
            if (longUrl.includes(domain)) {
                longUrl = "https://www.baidu.com/s?wd=%E5%9B%BD%E5%AE%B6%E5%8F%8D%E8%AF%88%E4%B8%AD%E5%BF%83APP";
                break;
            }
        }

        if (shortKey) {
            const existingValue = await kv.get(shortKey);
            if (existingValue) {
                return new Response(JSON.stringify({
                    Code: 201,
                    Message: `The custom shortKey \"${shortKey}\" already exists.`
                }), {
                    status: 200,
                    headers: corsHeaders
                });
            }
        } else {
            shortKey = generateRandomKey(7);
        }

        await kv.put(shortKey, longUrl);

        const host = request.headers.get("CDN-Client-Host") || request.headers.get("EO-Client-Host") || request.headers.get("host");
        const shortUrl = `https://${host}/${shortKey}`;
        const ip = request.headers.get("EO-Client-IP") || request.headers.get("cf-connecting-ip");
        const city = request.headers.get("EO-Client-City") || request.headers.get("cf-ipcity") || (request.cf && request.cf.city) || null;

        return new Response(JSON.stringify({
            Code: 1,
            Message: "URL stored successfully",
            ShortUrl: shortUrl,
            LongUrl: longUrl,
            ShortKey: shortKey,
            ip: ip,
            city: city
        }), {
            status: 200,
            headers: corsHeaders
        });
    }

    function generateRandomKey(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function decodeBase64(encodedString) {
        return atob(encodedString);
    }
}
