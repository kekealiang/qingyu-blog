-- 清理历史遗留的「图片存 D1」记录：早期媒体库以 data URL（base64）把图片内容直接存进
-- media.url，单图可达数 MB，会拖垮列表查询与页面加载。
-- 现媒体库已全面改为 R2 直传（浏览器预签名 PUT 上传，D1 只存元数据 + R2 公开地址），
-- 且接口层不再接受 data:image 登记（POST /api/media 仅允许 http/https）。
-- 历史上写入的 base64 行已无法再维护（无对应 R2 对象，删除时也无法回收存储），故一次性清除。
-- DELETE 天然幂等，可随每次部署重复执行。
DELETE FROM media WHERE url LIKE 'data:image/%';
