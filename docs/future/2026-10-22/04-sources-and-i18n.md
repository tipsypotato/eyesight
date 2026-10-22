# 04 · 医学依据、术语与中英文校验

归档日期：2026-10-22。本文给出内容依据和实施审校流程；新增 UI/题目尚未编写，没有本次新增翻译“已通过”结论，也没有眼科专家审核结论。

## 1. 来源登记与使用范围

以下链接用于核对事实，按自己的教学语言改写。网页可读不等于其中的图片、模型或原文可任意复制；首期使用当前程序几何与自行生成的测试图。访问日期不代表源文最新更新时间。

| ID | 来源与链接 | 本包使用的范围 |
| --- | --- | --- |
| M01 | [NEI — How the Eyes Work](https://www.nei.nih.gov/eye-health-information/healthy-vision/how-eyes-work) | 角膜/晶状体聚焦、虹膜/瞳孔入光、视网膜将光转换为神经信号、视神经传出 |
| M02 | [NEI — Cataracts](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/cataracts) | 晶状体混浊、视觉质量影响；支持白内障模块及儿童输入受限的原因背景 |
| M03 | [NEI — Glaucoma](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/glaucoma) | 视神经损害、早期可无明显症状、眼压并非唯一判断、既有损失不能被治疗直接逆转 |
| M04 | [NEI — Glaucoma and Eye Pressure](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/glaucoma/glaucoma-and-eye-pressure) | 房水流出与眼压关联、小梁网/房角机制；不据此制造诊断阈值 |
| M05 | [NEI — Amblyopia (Lazy Eye)](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/amblyopia-lazy-eye) | 儿童视觉发育、常见原因、单眼或双眼受影响、早期识别的重要性；本包不提取治疗剂量 |
| M06 | [AAPOS — Strabismus](https://aapos.org/glossary/strabismus) | 眼位不一致、内/外斜、控制协调相关机制，以及儿童抑制/弱视可能关联 |
| M07 | [Webvision — Simple Anatomy of the Retina](https://www.webvision.pitt.edu/book/part-i-foundations/simple-anatomy-of-the-retina/) | 普通视网膜内外层、感光细胞/中间神经元/神经节细胞、黄斑与视盘方位、中央凹特化 |
| M08 | [NEI — Presbyopia](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/presbyopia) | 作为后续调节能力变化背景；老视不等于远视，不纳入本次四病核心范围 |
| M09 | [NEI — Refractive Errors](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/refractive-errors) | 屈光状态与成像关系；归一化实验不能变为个人验光工具 |
| M10 | [AAO EyeWiki — Reflexes and the Eye](https://eyewiki.aao.org/Reflexes_and_the_Eye) | 光照瞳孔反应及看近时的简化调节/会聚关系；不复制其图示或长段原文 |
| M11 | [NCBI Bookshelf / StatPearls — Physiology, Aqueous Humor Circulation](https://www.ncbi.nlm.nih.gov/books/NBK553209/) | 补充睫状体产生房水、后房经瞳孔到前房、不同流出路线的关系 |

M01—M10 的相关页面已在本轮或前序研究中查阅。M11 本次检索摘要可核对房水路线，但正文访问遇到验证页；不能标注已通读，实施者应在内容审核时补读可访问正文或等价权威来源。青光眼的疾病与眼压关系采用 NEI 的 M03/M04，不沿用较旧解剖教材将青光眼简单等同高眼压的段落。M07 只用于视网膜解剖，不用于覆盖本包青光眼边界。

工程采用结构注册、渲染/状态/模式分离及按需渲染；实际复用范围和来源保留在 LICENSE 与 THIRD_PARTY_NOTICES。源码许可不自动覆盖外部模型、医学插画、截图或网页文字。新增资产需要登记作者、原始地址、许可、修改和归属要求；没有清晰许可时继续用当前自行生成的示意资源。

## 2. 把事实、示意和推导分开

| 内容 | 分类与实现要求 |
| --- | --- |
| 晶状体混浊是白内障的核心结构变化 | 来源支持的医学事实；对应 M02 |
| opacity=0.55 是初始演示值 | 产品显示参数；无医学严重度含义 |
| 房水流出受限可能影响眼压 | 医学机制；M04/M11，动画不计算真实眼压 |
| 一个压力值生成固定损害/视野 | 本包不支持此推导；禁止新增这种映射 |
| 两眼对同一目标协调、偏斜方向按鼻/颞区分 | 解剖/几何与教学规则；M06，世界坐标是产品约定 |
| 默认内斜 +10°、外斜 -10° | 教学几何预设；不是分级、检查结果或治疗依据 |
| 弱视与发育期异常输入相关 | 来源支持的概念；M05/M06 |
| 改善输入立即清除已有视觉发育问题 | 错误的简化；不实现 |
| 三维与二维共享归一化追迹 | 工程一致性要求；不是临床光学精度声明 |
| 定性视野图、模糊/眩光预览 | 教学插图；不能标成患者真实视野、视力值或诊断测试 |

每份新增内容至少保留：`sources`、`contentVersion`、`translationStatus`、`medicalReviewStatus`。翻译状态建议为 draft / llm-checked；医学状态为 pending / expert-reviewed，只有实际专家审阅完成并有记录时才后者。LLM 判断“医学术语一致”不自动升级医学状态。

## 3. 中英文术语表

ID 保持稳定，不跟随译文更名。英文首次出现可补通俗解释；不能依赖不严谨俗称作为唯一名称。表内术语是实施约束，新增整句文案仍需下节校验。

| ID / 上下文 | 中文 | English | 需要防止的歧义 |
| --- | --- | --- | --- |
| `cornea` | 角膜 | Cornea | 不是晶状体，位于眼前透明区域 |
| `sclera` | 巩膜 | Sclera | “眼白/白眼球”是搜索别名 |
| `iris` | 虹膜 | Iris | 有颜色的环形组织；不是中央开口 |
| `pupil` | 瞳孔 | Pupil | 开口，不是黑色实体组织 |
| `ciliary-body` | 睫状体 | Ciliary body | 与睫毛不同；调节/房水说明各自清楚 |
| `zonules` | 晶状体悬韧带 | Zonular fibers | 传递张力，不主动收缩为肌肉 |
| `lens` | 晶状体 | Crystalline lens | 普通正文可用 lens；外部镜片用 corrective lens 明确区分 |
| `anterior-chamber` | 前房 | Anterior chamber | 角膜与虹膜之间的房水空间 |
| `posterior-chamber` | 后房 | Posterior chamber | 虹膜后方狭窄空间，不是 vitreous chamber |
| `vitreous` | 玻璃体 | Vitreous body | 凝胶；玻璃体腔另称 vitreous chamber |
| `choroid` | 脉络膜 | Choroid | 不等同整个葡萄膜 |
| `retina` | 视网膜 | Retina | 与脉络膜/巩膜分层清楚 |
| `macula` | 黄斑 | Macula | 区域，中央凹在其中央 |
| `fovea` | 中央凹 | Fovea | 不直接译成 yellow spot |
| `optic-disc` | 视盘 | Optic disc | 神经纤维离眼处，不是黄斑 |
| `optic-nerve` | 视神经 | Optic nerve | 传递神经信号，不传可见光线 |
| `retinal-vessels` | 视网膜血管 | Retinal vessels | 包含动静脉，不只“发出”的动脉 |
| `iridocorneal-angle` | 虹膜角膜角（房角） | Iridocorneal angle | 区域，不是独立环形厚组织 |
| `trabecular-meshwork` | 小梁网 | Trabecular meshwork | 说明小梁网路线，不冒充全部房水流出途径 |
| 流体 | 房水 | Aqueous humor | 不与 vitreous body 互译 |
| 方位 | 鼻侧 / 颞侧 | Nasal / Temporal | 不按屏幕左右定义 |
| 眼侧 | 右眼 OD / 左眼 OS | Right eye OD / Left eye OS | 标签、选取、题干均需对应 |
| `oblique` 相机 | 斜向 | Oblique | **不能译为“斜视”** |
| `sagittal` | 矢状面 | Sagittal plane | 对应 x 平面 |
| `axial` | 水平面 | Axial plane | 本工程对应 y 平面，不是眼轴长度控件 |
| `coronal` | 冠状面 | Coronal plane | 对应 z 平面 |
| `cataract` | 白内障 | Cataract | 晶状体混浊，不是任何视物不清 |
| `glaucoma` | 青光眼 | Glaucoma | 不译成 high eye pressure |
| `strabismus` | 斜视 | Strabismus | 双眼眼位不一致，不是斜向相机 |
| `esotropia` | 内斜视 | Esotropia | 偏斜眼相对目标向鼻侧 |
| `exotropia` | 外斜视 | Exotropia | 偏斜眼相对目标向颞侧 |
| `amblyopia` | 弱视 | Amblyopia | Lazy eye 可作辅助俗称，不能单独解释为肌肉懒惰 |
| `anisometropia` | 屈光参差 | Anisometropia | 两眼屈光状态差异；不是斜视 |
| `deprivation` 机制 | 视觉剥夺（输入受限） | Visual deprivation | 不指患者主动不看东西 |
| 聚焦状态 | 离焦 | Defocus | 与散射、视觉发育问题区分 |
| 生理 | 调节 | Accommodation | 不翻成软件设置 adjustment |
| 生理 | 会聚 | Convergence | 正常近距离注视可发生，不等于内斜视 |
| 功能 | 复视 | Diplopia / Double vision | 可能情境，不写所有斜视必然复视 |
| 功能 | 视觉抑制 | Visual suppression | 神经信息处理概念，不是瞳孔关闭 |
| 功能 | 视野缺损 | Visual field defect | 不等同中心视力下降或黑圈滤镜 |
| 屈光 | 老视 | Presbyopia | 不与远视 hyperopia 混用 |

## 4. 关键界面文案种子

以下作为实现起稿，交付前仍需对照实际动作校验。文案不写固定“左栏/右栏”，避免与窄屏布局矛盾。

| 建议键 | 中文 | English |
| --- | --- | --- |
| `locateStructure` | 定位此结构 | Locate structure |
| `returnPreviousView` | 返回定位前视角 | Return to previous view |
| `resetCamera` | 重置视角 | Reset view |
| `resetScene` | 重置场景 | Reset scene |
| `flipSection` | 翻转保留侧 | Flip retained side |
| `sectionAnatomicalLock` | 切面固定在眼球坐标 | Section fixed to eye coordinates |
| `saveComparison` | 保存为对照 | Save as reference |
| `reference` | 对照 | Reference |
| `current` | 当前 | Current |
| `practiceLesson` | 练习本课 | Practice this lesson |
| `continuePractice` | 继续练习 | Continue practice |
| `reviewMistakes` | 复习错题与已看答案题 | Review incorrect and revealed answers |
| `answerRevealed` | 已看答案，不计答对 | Answer revealed; not counted as correct |
| `commonEyeConditions` | 常见眼病 | Common eye conditions |
| `normalStructure` | 正常结构 | Normal structure |
| `mechanismChange` | 发生什么变化 | What changes |
| `functionalImpact` | 功能会怎样受影响 | How function may be affected |
| `practiceUnderstanding` | 练习理解 | Check your understanding |
| `resetIllustration` | 重置本章示意 | Reset chapter illustration |
| `illustrationResetNote` | 重新演示，不表示临床恢复 | Restarts the illustration; does not imply clinical recovery |
| `qualitativePreview` | 定性示意，不代表视力检查结果 | Qualitative illustration, not a visual acuity test result |
| `glaucomaRiskNote` | 眼压升高是风险关系，不单独等于青光眼诊断 | Elevated eye pressure is a risk factor, not a diagnosis of glaucoma on its own |
| `developmentModelNote` | 儿童视觉发育机制示意；眼部几何沿用成人教学模型 | Childhood visual development illustration using the adult teaching eye geometry |
| `storageUnavailable` | 无法保存到本地，本次仍可继续学习 | Local saving is unavailable. You can continue learning in this session |
| `backToModel` | 返回模型 | Back to model |

## 5. LLM 翻译与语义校验（I18N-01）

### 5.1 输入与角色

所有新增用户可见文字先确定稳定 key，包括 UI、图例、结构字段、课程、任务、题干、选项、每选项反馈、错误、空状态、ARIA、快照说明。先写清中文医学含义，再生成自然英文；若英文先写，反向同样处理。无需逐字对应，但动作结果、医学条件、否定、范围必须等价。

校验使用与起稿分离的一次 LLM 审阅上下文；可以使用相同模型的独立校验轮，也可以其他模型。提供的是待审中英对、术语表、必要的自己撰写的事实摘要及来源链接，不整篇复制受版权保护网页。审阅者不能只看原始中文猜测英文，也不能只做拼写检查。

### 5.2 可直接复用的审阅提示

```text
你负责眼解剖与科普交互的中英文等价性校验。
输入包含稳定 key、中文、英文、出现位置、动作结果、术语约束和事实来源 ID。
逐条核对，不要漏项：
1. 解剖结构、左右眼、鼻颞/前后/内外、空间与实体、光与神经信号。
2. 病因/风险/疾病/症状的区别；可能与必然；否定、数量、范围、单位。
3. UI 动作及结果，重置范围，答案锁定/揭晓/得分，移动端位置语义。
4. 归一化示意与临床参数的界限，不得新增诊断或治疗承诺。
5. 中英文是否同时保留必要条件，英文是否自然易懂。
每个 key 输出 pass 或 issue。issue 给出严重度、具体差异、建议中文/英文、原因。
不得凭语言校验认定医学专家审核通过；来源无法核实时写清待核对。
最后输出已审 key 清单、总数、遗漏项、未解决项，不凭印象概括“全部正确”。
```

### 5.3 处理与复核

1. 导出待审清单，记录 contentVersion、文件路径/字段、每项文字及批次指纹。不要在运行时调用 LLM 翻译。
2. 运行 LLM 对照审阅；保留模型名称、日期、输入范围、逐条结论和修改建议。未实际调用/审阅不得填写 pass。
3. 修正文案后再次审查修改项及受影响上下文。术语、眼侧、否定、机制或评分错误属于阻断项，不能以“可读”放行。
4. 自动检查 key 覆盖、两语言非空、占位符和插值一致；手动查看桌面/窄屏英文长文案、ARIA 与场景动作是否相符。
5. 将批次记录追加到现有 `docs/translation-review.md`，写明新增/修改对数、问题与修正、残留问题和未覆盖范围。不要覆盖原 206 对的历史审校记录，也不要把历史通过自动套到新内容。
6. 只有全部待交付新增/变更 key 已检查、阻断项为 0、修改项复核完成，才标 llm-checked。界面医学内容仍按实际 medicalReviewStatus 显示。

### 5.4 记录格式

| 字段 | 要求 |
| --- | --- |
| Batch / date / model | 可追溯到真实审阅轮，不编造独立审阅者 |
| Input scope | 文件、key 清单、版本、指纹；明确只改布局时是否有新文字 |
| Counts | 审阅对数、问题对数、修正后复核对数；总数能核对 |
| Findings | key、严重度、原问题、修正、结论；无需泄漏任何 API 凭据 |
| Remaining | 未解决项、来源访问限制、未做的 UI/读屏/医学专家审核 |

归档文档本身主要使用中文，是实施规格而非已接入的新语言包；本次没有新增应用 key，因此不新造“翻译通过”批次。

## 6. 医学与内容验收门槛

实现交付前逐项检查：结构/机制对应来源；虚构示意值有明确标识；正常与病理分开；四种疾病没有共用错误机制；题干与反馈不出现互相矛盾结论；光、房水、神经信号三种通路图例和终点不同；眼侧/鼻颞/年龄范围明确。

工程师或 LLM 可以完成一致性与来源核对，但不能在状态栏自称眼科专家审核通过。后续若用于更正式的医学教学，建议请眼科/解剖教学人员审核几何、病例表现、术语和题目；记录真实审阅范围与日期，不把审阅一个页面推及全部模块。专家意见影响机制时先修正相关模型、题目和译文，再更新审校状态。

对用户提出的个体症状或治疗问题，本 demo 的章节不收集病史也不产生个人结论。此边界落实在功能与文案上即可，无需增加与教学无关的问诊表或反复弹窗。
