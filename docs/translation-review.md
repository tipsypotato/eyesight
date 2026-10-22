# 中英文独立 LLM 翻译审校

审校日期：2026-10-22。

审校角色：独立于解剖内容初稿编写者的 LLM 审校员。本文记录语言一致性与基础术语核对，不构成眼科专家审核、临床认证或患者个体判断。

## 范围与统计

逐条对照 `src/anatomy/data.ts` 与 `src/content/messages.ts` 中全部 `zh` / `en`。审查名称、完整含义、前后及内外关系、鼻颞方位、左右眼、数量、操作指令与模型局限。追加核对 `src/ui/App.tsx` 与 `src/engine/EyeEngine.ts` 中两对内联无障碍文案，单独记录，不混入下表的主语言包统计。所有文字均保留在本地静态代码中；未接入运行时翻译 API。

| 类别 | 条目 | 双语对数 | 文字数 |
| --- | ---: | ---: | ---: |
| 结构名称 `name` | 17 | 17 | 34 |
| 结构简介 `summary` | 17 | 17 | 34 |
| 结构功能 `function` | 17 | 17 | 34 |
| 结构位置 `position` | 17 | 17 | 34 |
| 结构知识点 `fact` | 17 | 17 | 34 |
| 分组名 | 4 | 4 | 8 |
| 导览标题与简介 | 3 × 2 | 6 | 12 |
| 导览步骤标题与正文 | 11 × 2 | 22 | 44 |
| 界面文案 | 87 | 87 | 174 |
| 合计 | — | **204** | **408** |

17 个拉丁学名、来源标题与 URL 没有 `zh` / `en` 配对，不计入上述总数；未对拉丁命名做专门标准认证。

## 结构逐条审计

每行均核对 `name`、`summary`、`function`、`position`、`fact` 五对文字；下表列出该行重点与修正后结论。

| ID | 中英文名称 | 重点与结论 |
| --- | --- | --- |
| cornea | 角膜 / Cornea | 透明前部、与巩膜连续、前房前壁、折射及保护的含义一致。 |
| sclera | 巩膜 / Sclera | 白色外层、位于脉络膜外侧、眼外肌附着及支撑一致。 |
| iris | 虹膜 / Iris | 色素环、瞳孔开口、调节入光量及角膜后/晶状体前关系一致。 |
| pupil | 瞳孔 / Pupil | 明确是开口而非黑色组织；修正光通过虹膜本身的含混表述。 |
| ciliary-body | 睫状体 / Ciliary body | 睫状肌与睫状突、房水产生、近调节时悬韧带张力减小一致。 |
| zonules | 晶状体悬韧带 / Zonular fibers | 纤维连接晶状体囊、传递张力；没有误译为主动收缩肌肉。 |
| lens | 晶状体 / Lens | 双凸、与角膜共同聚焦、调节及前后位置一致。 |
| anterior-chamber | 前房 / Anterior chamber | 角膜与虹膜间的房水空间、后房经瞳孔流入一致。 |
| posterior-chamber | 后房 / Posterior chamber | 虹膜后方的狭窄房水空间；补全英文中与眼后部大腔隙的区分。 |
| vitreous | 玻璃体 / Vitreous body | 凝胶与所占玻璃体腔区分清楚；未与房水互译。 |
| choroid | 脉络膜 / Choroid | 血管及色素层、营养外层视网膜、巩膜内/视网膜外关系一致；中文简介收窄至英文同等范围。 |
| retina | 视网膜 / Retina | 视杆/视锥、光转神经信号、位于玻璃体外/脉络膜内一致。 |
| macula | 黄斑 / Macula | 精细中央视觉、颜色、中央凹位于其中央、在视盘颞侧一致。 |
| fovea | 中央凹 / Fovea | 黄斑中心、视锥密集、视盘颞侧及中心无视网膜血管一致。 |
| optic-disc | 视盘 / Optic disc | 神经纤维汇集、血管通道、黄斑鼻侧及生理盲点一致。 |
| optic-nerve | 视神经 / Optic nerve | 神经节细胞轴突、经视盘离眼、传递电信号而非光线一致。 |
| retinal-vessels | 视网膜血管 / Retinal vessels | 内层视网膜供血及静脉回流一致；位置文案改为血管在视盘进出，覆盖动静脉。 |

四个分组的对应关系完整：眼球壁 / Eye wall、前段结构 / Anterior structures、眼房与玻璃体 / Chambers & vitreous、眼底与视神经 / Fundus & optic nerve。

## 导览逐条审计

三个导览的标题与简介均已核对。`anatomy` 明示成人右眼及示意模型；`vision` 区分光学与神经信号；`myopia` 限定轴性近视示例，不推广至所有近视原因。下表每行涵盖步骤标题和正文两对文字。

| 导览 / 步骤 | 重点与结论 |
| --- | --- |
| anatomy / 1 | 巩膜、角膜连续性及前后方向一致。 |
| anatomy / 2 | 从外向内为巩膜、脉络膜、视网膜；功能次序一致。 |
| anatomy / 3 | 三个空间为前房、后房、玻璃体腔；前两者含房水，第三者含凝胶一致。 |
| anatomy / 4 | 两个眼底地标指黄斑区域与视盘；中央凹包含于黄斑区域。黄斑/中央凹在视盘颞侧，视盘在黄斑鼻侧；不以屏幕左右替代解剖方向。 |
| vision / 1 | 远处物体的近似平行光、角膜折射、通过瞳孔一致。 |
| vision / 2 | 角膜与晶状体共同聚焦；不模拟调节和全部像差的局限一致。 |
| vision / 3 | 正常示例焦点在视网膜、光转电信号、示意光线轨迹在此结束一致。 |
| vision / 4 | 视网膜处理后由神经节细胞轴突及视神经传递神经信号；光不沿视神经传播一致。 |
| myopia / 1 | 正常眼远处光线在视网膜会聚，相对位置的比较任务一致。 |
| myopia / 2 | 固定屈光力、增加眼球前后长度、焦点在视网膜前且到达时已发散一致。 |
| myopia / 3 | 眼前发散镜片将示例焦点移回视网膜；没有个人验光处方含义。 |

## 界面文案逐类审计

下列分组覆盖全部 87 个键，统计无重复、无遗漏。审校允许自然语言表达不同，但医学关系、操作结果与状态含义应对应。

| 类别 | 对数 | 全部键 |
| --- | ---: | --- |
| 品牌与模型范围 | 8 | tagline, rightEye, schematic, sceneTitle, anatomyCount, modelNote, info, derived |
| 模式与进度 | 6 | explore, optics, tour, quiz, progress, step |
| 视角与场景操作 | 20 | drag, dragQuiz, view, oblique, front, side, back, zoomIn, zoomOut, reset, labels, clip, sagittal, axial, coronal, sectionPosition, explode, focus, isolate, showAll |
| 结构列表与资料 | 17 | structures, search, noResults, layerHint, on, ghost, off, position, function, fact, sources, tissue, region, space, pickTitle, pickBody, startExplore |
| 光学说明 | 11 | normal, myopia, corrected, opticsTitle, normalBody, myopiaBody, correctedBody, rays, retinalPlane, focalPoint, opticsNote |
| 导览操作 | 8 | toursTitle, toursBody, startTour, previous, next, finishTour, backTours, tourDone |
| 测验操作与反馈 | 14 | question, quizBody, reveal, correct, incorrect, revealed, nextQuestion, result, quizComplete, score, retry, backExplore, quizPanel, quizHint |
| 错误与恢复 | 3 | webglError, loadError, reload |

特别核对：三种显示状态及顺序一致；每题仅一次作答、揭晓结束本题且不计分一致；17 个结构和 3 条短导览与数据相符；正常/轴性近视/矫正三种模式一致；归一化长度及光焦度没有被译为验光度数。`axial` 视角选项的 Axial 与水平面在此指同一剖切平面。

## 追加内联无障碍与响应式文案审校

本节于同日追加，主语言包仍为 **204 对 / 408 条**。另有下面 **2 对 / 4 条**内联文案已核对，因此有中英文分别存储的审校范围合计 **206 对 / 412 条**。

| 位置 | 中文 | 英文 | 审校结论 |
| --- | --- | --- | --- |
| `src/ui/App.tsx` 导航 `aria-label` | 学习模式 | Learning modes | 两语均描述导航内的四种学习模式，无术语或数量不一致；无需修改。 |
| `src/engine/EyeEngine.ts` 画布 `aria-label` | 可旋转的右眼三维模型。方向键旋转，加减键缩放。 | Rotatable 3D right eye. Arrow keys rotate; plus and minus zoom. | 两语均明确右眼、旋转及缩放；只读核对处理函数可见四个方向键旋转、`+` / `-` 缩放，并接受 `=` 作为放大替代键。说明与实现一致；未执行键盘或读屏测试。 |

应用内其他使用 `t()` 的无障碍标签和装饰眉题复用已审校词条，不新增双语对数。固定标签 `Language / 语言` 为一条同时显示两语的语言选择说明，不计为分别存储的双语对；品牌 `eyesight` 与拉丁右眼名称 `OCULUS DEXTER · OD` 为专名/术语，未作为漏译处理。

响应式页面在窄屏会将结构列表移至模型下方，`messages.pickBody` 的双语现均只说明“模型或结构列表中的结构”，没有固定左/右/上/下位置。中文去掉“左侧”，英文显式使用 `structure list`；这一追加修改仍属于原来已修正的 `pickBody` 同一对文案，因此修正总数保持 11 对。

## 具体修正

共修正 **11 对**文字：1 个分组名、4 个结构字段、6 个界面字段。导览没有发现必须修改的翻译问题。

| 位置 | 原问题 | 修正 |
| --- | --- | --- |
| GROUPS.inside.name.zh | “房室”在医学语境容易联想到心脏房室。 | 改为“眼房与玻璃体”。 |
| pupil.function.zh/en | “通过虹膜 / through the iris”可能理解为穿过虹膜组织。 | 双语均明确通过虹膜中央开口。 |
| posterior-chamber.fact.en | 相比中文，遗漏“并非眼球后部的大腔隙”。 | 补全前段与眼后大腔隙的区分。 |
| choroid.summary.zh | “眼球壁中层”比英文范围更宽，容易将脉络膜等同于整个中层。 | 改为“眼球壁中……的一层组织”。 |
| retinal-vessels.position.zh/en | 原表述只强调从视盘发出或分支，未完整涵盖静脉回流。 | 双语改为主血管在视盘进出、血管弓绕行黄斑。 |
| messages.schematic.en | 遗漏“示意”性质。 | 改为 Schematic teaching model。 |
| messages.layerHint.en | 遗漏圆点所在的右侧位置。 | 补为 Right-hand dot。 |
| messages.oblique.zh | “斜视”可被理解为眼位疾病。 | 视角标签改为“斜向”。 |
| messages.pickBody.zh/en | 点击整个模型的说法含混，英文 connections 不如“相邻关系”明确；固定“左侧”与窄屏布局不符。 | 明确选择模型或结构列表中的结构，并查看与邻近结构的关系；两语均不依赖列表的固定方位。 |
| messages.normal.zh | “正常成像”比 Normal focus 更广，可能暗示完整成像模拟。 | 改为“正常聚焦”。 |
| messages.retinalPlane.en | Retina 遗漏中文的“位置”含义。 | 改为 Retinal position。 |

## 参考核对与验证

2026-10-22 查阅了以下公开资料，用于核对相关概念而非复制原文：

- 角膜、瞳孔、晶状体、视网膜及神经信号流程：[NEI — How the Eyes Work](https://www.nei.nih.gov/eye-health-information/healthy-vision/how-eyes-work)。
- 近视焦点在视网膜前，以及眼轴偏长只是成因之一：[NEI — Nearsightedness (Myopia)](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/nearsightedness-myopia)。
- 三腔区别与眼球壁层次：[AAO EyeWiki — Basic Histology of the Eye and Accessory Structures](https://eyewiki.aao.org/Basic_Histology_of_the_Eye_and_Accessory_Structures)。
- 中央凹在视盘颞侧、视网膜内外层、神经节细胞轴突及血管分布：[Webvision — Simple Anatomy of the Retina](https://www.webvision.pitt.edu/book/part-i-foundations/simple-anatomy-of-the-retina/)。

验证结果：

- `npm test -- src/anatomy/data.test.ts`：6/6 通过，覆盖结构唯一性、双语字段、分组、瞳孔与眼房区分、三导览及范围说明。
- Node 原生 assert 检查：204 个对象均具且仅具 `zh` / `en`，中文/英文字段非空且无占位词；87 个界面键、17 个唯一结构及 11 个导览步骤确认。
- 两个数据文件的独立严格 TypeScript 检查通过：`./node_modules/.bin/tsc --noEmit --ignoreConfig --strict --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck src/anatomy/data.ts src/content/messages.ts`。
- 未添加只检查固定文案字面量的测试，也未改变任何数据 ID、界面键、结构数量或运行时接口。

## 剩余限制

- LLM 可以核对文本中的一致性与术语，但无法替代眼科、解剖学及医学教育专家的独立审校；界面已有“医学内容待专家审校”说明并保留。
- 本轮没有验证相机朝向、实际网格的左右/鼻颞位置、剖切几何、光线与可视视网膜是否重合，亦没有进行浏览器排版或屏幕阅读器检查。这些属于整体验收。
- 内容链接中的 NCBI `Gross Anatomy of the Eye` 在本轮返回浏览器验证页，未独立重读该页面；相关概念另参考上列可访问资料。没有把链接可访问性等同于医学正确性。
- 本模型是成人右眼的教学示意；不表达个体尺寸、完整组织学、全部光学像差或验光处方。本轮未添加这些功能或医学结论。
