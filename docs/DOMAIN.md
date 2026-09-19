# 接入 latentk.com

个人网站已配置为独立仓库 `slackkai/latentk.com`。DNS 接通前，使用：

- 网站：https://slackkai.github.io/latentk.com/
- 后台：https://slackkai.github.io/latentk.com/admin/

2026-09-19 公网 DNS 查询结果：`latentk.com` 的 A 记录为 `34.216.117.25` 和 `54.149.79.189`，不是 GitHub Pages 地址；权威 NS 为 `launch1.spaceship.net` / `launch2.spaceship.net`。

## 域名设置

1. 打开个人站仓库 [Settings → Pages](https://github.com/slackkai/latentk.com/settings/pages)，在 Custom domain 填入 `latentk.com` 并保存。不要把域名填到主题仓库。
2. 在域名 DNS 控制台，把根域名 `@` 的现有 A 记录替换为下面四条：

| 类型 | 主机名 | 值 |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | slackkai.github.io |

`www` 是可选别名。保留无关的 MX/TXT 等记录；如果同一主机名有旧的 AAAA 或 CNAME，按 GitHub 文档核对并消除指向其他服务的冲突。

3. 等待 GitHub Pages 的 DNS 检查和证书签发完成，然后打开 Enforce HTTPS。
4. 在 Actions 中重新运行 **Deploy to GitHub Pages**。工作流会读取新的域名与根路径，更新 canonical、RSS、搜索和后台配置。

当前采用 GitHub Actions 发布，域名由仓库 Pages 设置管理，不依靠提交 `public/CNAME` 来设置自定义域名。接入前的子路径构建与接入后的根域名构建使用同一套代码。

参考：[GitHub 官方自定义域名配置](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)。
