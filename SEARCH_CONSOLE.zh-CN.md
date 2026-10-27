# 让 Google 发现并检查 RealWorth

网站：https://ethanli0831.github.io/RealWorth/

站点地图：https://ethanli0831.github.io/RealWorth/sitemap.xml

中文介绍：https://ethanli0831.github.io/RealWorth/zh.html

## 已完成的站内工作

- 每个公开 HTML 页面有自己的标题、描述、canonical 和允许索引的声明。
- 站点地图列出七个公开页面，不把金融数据 JSON 当作落地页。
- 英文与静态中文概览互相链接，并只在这两个等价概览上声明语言版本。
- About、Methodology 和公开仓库说明维护方式、公式、来源、限制及纠错入口。
- 提供与可见内容相符的 WebPage / WebSite 结构化信息、分享标题及图片。
- 不填写虚构的金融资质、评价星级、Google 验证码或搜索排名承诺。

2026-10-27 的访问检查：首页返回 200，没有 X-Robots-Tag 禁止索引响应头；
源站根路径 /robots.txt 返回 404，未发现该文件的抓取禁令。修改前站点地图为 404，
现已补齐。未取得 Search Console 的所有权访问，因此不能据此判断 Google 实际
是否已经收录，也不能把“尚无 sitemap”断言为唯一原因。

## 需要网站所有者完成的步骤

1. 打开 https://search.google.com/search-console ，用自己的 Google 账号登录。
2. 添加资源时选 **网址前缀 / URL prefix**，填写完整的
   `https://ethanli0831.github.io/RealWorth/`，保留项目路径和最后的斜杠。
   此 GitHub Pages 项目不控制 github.io 的 DNS，不要尝试验证 github.io 域名资源。
3. 选择 **HTML 文件**验证，下载 Google 实际提供的验证文件。
   将该文件原样放入本仓库 `docs/`，使用 Google 给出的文件名，提交部署。
   例如 Google 若给出 googleABC123.html，就应能公开访问
   `https://ethanli0831.github.io/RealWorth/googleABC123.html`。
   不要自行编造文件名、内容或验证 token。也可使用 Google 提供的 HTML meta 标签，
   但必须加入真实标签，不能用占位值。
4. 确认验证地址能访问，再回到 Search Console 点击验证。
5. 打开 **站点地图 / Sitemaps**，提交 `sitemap.xml`；如果界面要求完整地址，
   使用上方完整站点地图 URL。
6. 打开 **网址检查 / URL inspection**，检查首页和 `zh.html`。
   先查看抓取及索引状态；可运行实时测试，再点击请求编入索引。
7. 后续查看 **网页索引 / Page indexing**：区分尚未发现、已发现未编入索引、
   已抓取未编入索引、重复页／canonical 选择和真实抓取错误。按报告的具体原因处理，
   不要只反复提交同一 URL。

这一步需要所有者的 Google 账号验证；代码部署不能替代该验证，也不会自动代表
Google 已收录。不要向聊天或仓库提供 Google 密码、会话 cookie 或其他登录凭据。
Google 给出的公开验证 HTML / meta 标签可以用于部署所有权证明。

## 如何判断“搜不到”是哪种情况

- 搜网站名没有结果，可能是尚未收录，也可能是品牌词竞争或排名低。
- `site:ethanli0831.github.io/RealWorth/` 可以作为线索，但结果并非完整索引清单。
  Search Console 的网址检查才是站点所有者更可靠的诊断入口。
- 搜“Bitcoin”等通用词竞争非常大；先检查首页和品牌词，再逐步改善内容与引用。
- 有 sitemap、允许索引的标签或换用独立域名，都不保证收录或排名。
  抓取和索引可能需要时间，也可能因质量等因素不被采用。

## GitHub Pages 的 robots.txt 限制

Google 读取的是域名根路径：
`https://ethanli0831.github.io/robots.txt`。

在本项目发布 `https://ethanli0831.github.io/RealWorth/robots.txt` 不会控制该源站的
抓取规则，因此本次没有添加一个看似有效、实际不生效的项目 robots 文件。
如将来域名根 robots 阻挡本路径，应在真正控制根路径的网站仓库修复；
当前检查到根文件为 404，不需要为了收录强行创建它。

## 后续可持续做的事

持续提供有实质内容、可验证来源和清楚限制的研究。可在自己的 GitHub 项目介绍、
相关研究页面或真正相关的公开渠道链接到网站；不要批量制造垃圾链接。
金融内容尤其需要准确说明作者、数据、方法和能力边界。

官方参考：
- https://developers.google.com/search/docs/fundamentals/get-on-google
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://developers.google.com/search/docs/crawling-indexing/robots/intro


## 可选：给 GitHub 仓库增加官网入口

本次读取到仓库 About 的网站链接和描述为空。通过当前集成自动修改仓库元数据
时返回 HTTP 403（Resource not accessible by integration），因此没有宣称设置成功。
这不影响站内 SEO 文件和 GitHub Pages 发布。

你可以打开仓库首页右侧 **About → 齿轮**，将 Website 填为
`https://ethanli0831.github.io/RealWorth/`，再加一句准确的项目介绍并保存。
README 已有官网链接；不要为了搜索排名编造资质、评分或收益。
