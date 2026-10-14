# kiters — kite 的 Rust 重写:LLM 移交文档

> 本文档写给接手实现的 LLM(或未来的人)。它浓缩了一次深入 Go 版 kite 源码与
> 生产部署的全部关键认知。**读完即可动工,不需要再考古原仓库。**
> 原仓库:github.com/bailangvvkruner/kite(上游 kite-plus/kite)。

---

## 0. 一句话定位

把 kite(Go 静态博客 + 运行时 serve + wasm 插件 + React 工作站)用 Rust 重写,
**正确性从"运行时约定"升级为"类型系统事实"**。不是逐行翻译,是借 Rust 的
构造能力消灭 Go 版靠纪律维持的东西。非目标:像素级兼容 Go 模板方言、兼容
wazero 字节码细节、追求延迟(Go 版渲染已 <1ms,瓶颈在网线)。

---

## 1. 必须复刻的行为契约(从生产实战中学到的,不许改)

### 1.1 渲染契约
- 静态构建、预热、请求渲染走**同一条路径、同一套输入**:预热请求用 nil
  request,等于 build。**模板不得依赖 live request**(依赖了也 build 不出来,
  这是 kite 自己的契约,保留)。
- target 有 Kind:page/alias/notFound("404")等;renderTarget 是唯一咽喉
  (200 与 404 都走它)。alias 渲染为 200 + meta refresh/js 跳转,不是 301。

### 1.2 缓存语义(Go 版踩过的坑全部固化成规则)
- **缓存生命周期 = 站点快照生命周期**。reload 原子换快照,缓存随之清空;
  旧快照渲染中的页面不允许落进新缓存(靠 builder 指针比对——Rust 版换成
  Arc 生命周期后此类 bug 不存在)。
- **双池**:预热池(整站页面,只有计划写入,64MiB/4096)+ 询问池(按需渲染
  落这,8MiB/512)。洪水(`?x=随机数`)只能在询问池翻滚,挤不掉站点页。
- **cacheKey 归一化** `--cache-query`:
  - `strict`(默认):带 query 的请求照常渲染但**不缓存**
  - `ignore`:query 折叠进路径键(站点不读 query 时正确且洪水全 HIT)
  - `a,b`:白名单参数按固定序拼进键;含白名单外参数 → 渲染不缓存
- 响应头:`X-Kite-Cache: hit|miss`、`Vary: Accept-Encoding`、页面
  `Cache-Control: no-store`(预览语义,浏览器永不持旧站态)。
- 压缩:Accept-Encoding 协商 **br > zstd > gzip**(子串探测);<1024B 不压;
  每页每编码**只压一次**并记忆;LiveReload 注入页发 identity(注入发生在
  缓存之后,所以不能把注入页压缩缓存)。
- 单飞(hold):同 key 并发只渲染一次,其余等结果;map 自清理。

### 1.3 插件契约
- 钩子:TransformMarkdown / TransformHTML / PageRendered / BuildComplete。
- 沙箱:**零网络、零文件系统、零时钟旁路**;配置经 plugin.yaml + settings
  注入;i18n zh-CN.yaml;assets(css/js)由宿主代发。
- 现有插件:linkcard(裸链接独占 `<p>/<li>` 才转卡片,正则无反向引用——
  Go RE2 限制,迁移时 Rust regex 同为无回溯,兼容)、readcount(cf-umami
  协议 + umami share 兜底)。
- 插件无法影响 HTTP 层/跳过渲染成本——所以缓存必须在宿主里,这个判断保留。

### 1.4 admin API 契约(Studio React 前端吃这套,字段级对齐)
- 登录 `POST /api/v1/auth/login` `{"user","password"}` → cookie。
- 列表 `GET /contents?kind=post&status=draft&q=…&count=true&cursor=…`
  (**无 offset,用 cursor 翻页**——编辑中 offset 会重跳)。
- 改 `PUT /contents/{id}` **必须 `If-Match: <revision>`**,body 为 Draft:
  `{kind,title,slug?,status,body,meta?,taxonomies?,aliases?,published_at?}`;
  **kind 必传**(漏了 400)。冲突返 409 带 `theirs`(磁盘现值)。
- 删 `DELETE /contents/{id}` 带 If-Match。建 `POST /contents`。
- 草稿 = 私密文章:**对外 404,首页/sitemap/RSS/搜索全部排除**,仅登录后
  API 与 Studio 可见(生产验证过五重检查)。status 四态:
  draft/published/scheduled/archived,Studio 顶栏有状态胶囊。
- OpenAPI 在 internal/api/openapi.go,Studio 的 TS 客户端由此生成。

### 1.5 杂项安全
- SVG 上传清洗:script/foreignObject/iframe/object/embed/audio/video。
- `markdown.unsafeHTML: true` 开关(站点 yaml),默认 false。
- admin/API 路径永远不进任何缓存(部署层 EdgeOne 同样要排除)。

---

## 2. 五个签名设计(方案灵魂,别丢)

1. **快照换血**: `arc_swap::ArcSwap<Site>`;watch 线程重建整站→原子 store;
   请求线程 `load_full()` 拿一根 Arc 读整站。缓存正确性 = Arc 所有权。
   (Go 版的 stale-put 防护/reset 加锁/builder 指针比对,三类 bug 从此不可表达。)
2. **WIT 组件插件**: wasmtime Component Model + WIT 接口(见 §6 目录树里的
   `kiters.wit`)。协议带版本、类型安全、宿主/插件两侧代码由 wit-bindgen
   生成。宿主侧仍强制:无网络、无 fs。
3. **内容寻址增量**: blake3 指纹每个输入(文件、front matter、模板、插件
   wasm、配置)→ 依赖图(文章→自身 target + 首页/sitemap/taxonomy)→
   改动只点亮受影响节点。目标:改一篇 = 毫秒级重建(Go 版全量预热 10s)。
4. **类型状态管线**: `walk→parse→validate→plan→render` 每步返回
   `Builder<NextState>`;front matter 每种 kind 一个 serde 强类型;target
   是 enum 不是字符串。
5. **tower 乐高**: 压缩/缓存头/洪水免疫全部做成 layer,业务 handler 只管
   "快照里取页写字节"。

---

## 3. crate 选型

| 层 | crate | 理由 |
|---|---|---|
| 运行时/HTTP | tokio + axum + tower-http | h2/h3、压缩中间件现成 |
| 快照 | arc-swap | 无锁整站原子替换 |
| Markdown | comrak | GFM 兼容(对标 goldmark) |
| 高亮 | syntect | 注意:与 chroma 主题色不同,需重配色 |
| 模板 | minijinja(运行时主题) | 不复刻 Go template;写迁移器(§5) |
| 插件 | wasmtime + wit-bindgen + cargo-component | Component Model |
| 增量 | blake3 + 自写薄 salsa(依赖图~300行) | |
| 搜索 | tantivy + jieba-rs | 中文分词,比原版强 |
| 序列化 | serde + serde_yaml | front matter 宽容解析 |
| CLI | clap derive | |
| 校验和 | crc32fast/blake3 | |

---

## 4. 模块目录树(建议)

```
kiters/
  crates/
    core/          # 类型:Kind/Target/Plan/Content/FrontMatter(serde)
    parse/         # walk + front matter + comrak;类型状态 Builder<S>
    plan/          # 路由、alias、taxonomy、schedule、extras(rss/sitemap)
    render/        # 模板(minijinja)+ syntect + 短代码 + 内置布局
    plugins/       # wasmtime 宿主 + WIT 生成胶水 + 沙箱策略
    increment/     # blake3 指纹、依赖图、失效传播
    serve/         # axum、ArcSwap 快照、双池缓存、cacheKey、tower 层
    api/           # admin REST(utoipa OpenAPI)、If-Match/409、auth
    cli/           # clap: build/serve/new/migrate-theme
  wit/kiters.wit   # 插件协议(单一事实源)
  studio-adapter/  # 对齐现有 React Studio 的契约测试
  docs/            # 本文档 + 对拍报告
```

---

## 5. Go-template → minijinja 迁移器(M5 的核心)

需要自动翻译的构造清单(来自 almanac 实测):`{{ .X }}`→`{{ x }}`、
`{{ if }}/{{ else }}`、`{{ range .Items }}`→`{% for %}`、`with`→`with`、
`partial`/`template` 调用、`$.Root` 根引用、pipeline `|`、`printf`、
`default`、`where`(taxonomy 过滤)、`dateFormat`/`.Format`。**做不了语义
完美的就报错人工介入**,宁可半自动不可静默错译。迁移器本身用 Rust 写,
输入 Go 模板目录,输出 Jinja 目录 + 差异报告。

---

## 6. WIT 接口草案(起步版,放 wit/kiters.wit)

```wit
package kiters:plugin@1.0;

interface transform {
  record page  { url: string, html: string, meta: list<tuple<string, string>> }
  record site  { title: string, base-url: string, language: string }
  markdown: func(src: string) -> string;
  html: func(p: page) -> result<page>;
  page-rendered: func(p: page) -> page;
  build-complete: func(s: site) -> list<string>;  // 需要代发的 assets
}

world plugin {
  import host {
    setting: func(key: string) -> option<string>;
    log: func(level: log-level, msg: string);
  }
  export transform;
}
```

宿主调用点必须与 Go 版一致:TransformMarkdown 在 markdown 解析前、
TransformHTML 在 HTML 序列化后、PageRendered 每页产出后、BuildComplete 收尾。

---

## 7. 分期与验收(每期"完成定义")

- **M1 编译器内核**: `kiters build` 产出静态站点(内置布局,含中文 slug 的
  URL 编码正确)。验收:对一个 19 篇中文文章的 fixture,产物结构与 kite
  `build` 对拍(允许 HTML 属性顺序差异,文本内容逐字相等)。
- **M2 serve**: `kiters serve --cache --cache-query=ignore` + watch 增量。
  验收:X-Kite-Cache hit/miss 行为与 Go 版一致;洪水 1000 发随机 query 后
  站点页仍 HIT;watch 改文件后 <100ms 内新页可见且旧缓存整体消亡。
- **M3 插件**: linkcard/readcount 以 cargo-component 编译接入。验收:对
  同一 fixture,TransformHTML 后的 HTML 与 Go 版插件输出一致(图卡结构、
  裸链接独占段落判定)。
- **M4 Studio**: 现有 React Studio 不改一行连上。验收:登录→列表(草稿
  标签)→编辑(PUT If-Match)→冲突 409→发布→对外可见,全链路绿。
- **M5 主题**: migrate-theme 翻译 almanac。验收:渲染差异仅限高亮配色与
  属性空白;人工目检首页/文章页/列表页无错版。

---

## 8. 已知雷区(血泪清单)

1. Go RE2 与 Rust regex 都无反向引用——插件正则可直接迁;但 **Go 的
   `(?s)`/`(?i)` 混合要改写成 Rust 的 `(?s)(?i)`** 语法位。
2. wasmtime 与 wazero 的差异:wasmtime 用 Component Model,不是裸导出
   函数;内存增长语义不同,宿主要设 fuel/epoch中断防插件死循环。
3. chroma→syntect:主题 token 类目不同,色值需建立映射表,逐语言对拍。
4. 中文 slug:`/posts/密钥库/` 这类 URL,HTTP 层用 percent-encode,
   路由层用解码后的 path 匹配(Go 版 r.URL.Path 已解码,Rust 的
   axum Path 需显式 decode,别掉进双解码陷阱)。
5. front matter 宽容:YAML 为主但要容忍重复键警告、tab 报错的友好提示。
6. `no-store` 别丢:预览语义是产品决策(浏览器永不持旧站态),配合部署
   层(EdgeOne/Lucky)时由部署层改写浏览器 TTL,源站保持 no-store。
7. cursor 翻页没有 offset:编辑并发下 offset 会重/漏,契约不能改。
8. 对拍基线:Go 版仓库 `internal/serve` 有 parity test 传统(serve 与
   build 字节一致),kiters 的 M1/M2 验收要继承这个思路。

---

## 9. 生产环境事实(部署侧,不属于 kiters 代码但影响决策)

- 现网链路:访客 → 腾讯 EdgeOne(回源连接复用,稳态 80ms 无缓存)→
  Lucky 反代(443,br 透传)→ kite 容器(`--network host`,1717)。
- 源站是家宽 CGNAT + 纯 IPv6(i6.zipimg.cn AAAA),EdgeOne 回源走打洞的
  v4 端口;站点 kite.zipimg.cn。
- 服务器 5.8GiB 内存,kite(Go)占 192MiB(其中 ~51MB 是 4 个 wasm 沙箱);
  kiters 预期 30~50MiB,这差值对部署无实际意义,**不要为省内存牺牲架构**。
- EdgeOne 缓存规则(站点级):/admin、/api 不缓存;其余强制边缘 TTL 5min、
  不遵循源站 Cache-Control、浏览器 5min、Vary 开、404 不缓存——kiters
  上线时沿用同一套。

---

## 10. 起步三步(接手者今天就能干)

```bash
cargo new kiters --workspace
# 1. crates/core:Kind/Target/Plan 枚举 + serde front matter
# 2. crates/parse:walk(忽略 _drafts?不——drafts 是一等公民,靠 status)
# 3. 对拍 fixture:从 Go 版站点导出 content/ 与产物,放进 tests/fixture
```

记住纲领:**正确性靠构造,不靠约定。** 每写一块,先问"Go 版这里靠什么纪律
防错",然后把那个纪律变成类型、生命周期或所有权。

---

## 11. 动工实录(M1 已落,2026-10-14)

仓库:**github.com/bailangvvkg/kiters**(与本文档同日动工,提交 e7f4d82)

已落地:

- 工作区四 crate + 一 CLI:`kiters-core`(类型 + Hook API)、
  `kiters-parse`(walk/front matter/钩子埋点)、`kiters-render`
  (comrak + minijinja 内置布局)、`kiters-build`(计划 + 预渲染编排)、
  `apps/kiters-cli`。
- **七点全链钩子**(§2 的深化,已实测):`on_discover`(可 skip 文件)→
  `on_front_matter`(可改 slug/状态)→ `on_markdown`(可改正文)→
  `on_target`(可改地址/撤页)→ `on_html` → `on_page`(页面字节末权)→
  `on_build_complete`(只读报告)。链式有序,首个错误终止并具名
  "hook <名字> failed at <时刻>"。事件载荷带 `&mut`(含 veto 的 `&mut bool`)。
- 预渲染全站:文章页 + 首页 + 404 + sitemap + RSS;草稿全程排除
  (与 §1.4 私密语义一致)。fixture 中文站实测:
  `3 项(1 草稿)→ 6 页,2ms`。
- 5 项测试全绿:整站构建(草稿不落盘/sitemap/RSS/首页均无踪)、CLI、
  钩子改写正文、钩子否决目标、钩子失败具名、事件载荷。

实现注记:

- 开发机无 MSVC/Windows SDK:用 gnu 工具链 + `link-self-contained=yes`
  + `rust-lld`(见仓库 `.cargo/config.toml`,原因写在注释里)。
- comrak 0.24:`#[non_exhaustive]`,选项须 `Options::default()` 后改字段;
  代码块语言类名(`language-rust`)内置输出,无需高亮适配器。
- minijinja:`.html` 模板名自动转义,注入 body 必须 `| safe`。
- 配置兼容读 `kite.yaml` 或 `kiters.yaml` 的 `site:` 表。

M2(serve:ArcSwap 快照 + watch 增量 + 压缩协商 + 双池缓存键归一)
从本文档 §1.2 抄行为契约即可,钩子点火点不变。
