import type { Localized, StructureId } from '../anatomy/types';
import type { DiseaseId } from '../modes/disease';

export const DISEASE_CONTENT_VERSION = '2026-10-22-diseases';
export const DISEASE_SOURCES = {
  M02: { title: 'NEI · Cataracts', url: 'https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/cataracts' },
  M03: { title: 'NEI · Glaucoma', url: 'https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/glaucoma' },
  M04: { title: 'NEI · Glaucoma and Eye Pressure', url: 'https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/glaucoma/glaucoma-and-eye-pressure' },
  M05: { title: 'NEI · Amblyopia', url: 'https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/amblyopia-lazy-eye' },
  M06: { title: 'AAPOS · Strabismus', url: 'https://aapos.org/glossary/strabismus' },
  M11: { title: 'NCBI · Physiology, Aqueous Humor Circulation', url: 'https://www.ncbi.nlm.nih.gov/books/NBK553209/' },
  M15: { title: 'NCBI Webvision · Aqueous outflow diagram', url: 'https://www.ncbi.nlm.nih.gov/books/NBK543075/figure/diseases_glaucoma.F7A/' },
  M12: { title: 'AAPOS · Amblyopia', url: 'https://aapos.org/glossary/amblyopia' },
  M13: { title: 'AAPOS · Adult Strabismus', url: 'https://aapos.org/patient/patient-resources/adult-strabismus-new' },
  M14: { title: 'AAPOS · Convergence Insufficiency', url: 'https://aapos.org/glossary/convergence-insufficiency' },
  M16: { title: 'AAO · Amblyopia Preferred Practice Pattern (2023)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10701408/' },
  M17: { title: 'AAO · Primary Open-Angle Glaucoma Preferred Practice Pattern', url: 'https://www.aaojournal.org/article/S0161-6420(25)00815-2/abstract' },
};

export const DISEASE_STEPS: Localized[] = [
  { zh: '正常结构', en: 'Normal reference' },
  { zh: '发生什么变化', en: 'What changes' },
  { zh: '功能会怎样受影响', en: 'How function may be affected' },
  { zh: '理解确认（可选）', en: 'Check understanding (optional)' },
];
type DiseaseContent = {
  id: DiseaseId; name: Localized; tag: Localized; goal: Localized; related: StructureId[];
  steps: { question: Localized; body: Localized }[];
  sources: { title: string; url: string }[]; contentVersion: string;
  translationStatus: 'draft' | 'llm-checked'; medicalReviewStatus: 'pending' | 'expert-reviewed';
};
const metadata = { contentVersion: DISEASE_CONTENT_VERSION, translationStatus: 'llm-checked' as const, medicalReviewStatus: 'pending' as const };
const optionalStep = {
  question: { zh: '要确认刚才讲解的重点吗？', en: 'Would a few questions help review the explanation?' },
  body: { zh: '可随时离开答题，返回任一环节继续模型讲解，无需完成本组题目。', en: 'You can leave the questions at any time and return to any section to continue the model explanation, without completing the round.' },
};
export const DISEASES: Record<DiseaseId, DiseaseContent> = {
  cataract: {
    ...metadata, id: 'cataract', name: { zh: '白内障', en: 'Cataract' }, tag: { zh: '单眼 · 晶状体', en: 'Single eye · lens' },
    goal: { zh: '晶状体透明度下降，影响透光与成像质量。', en: 'Loss of lens transparency affects light transmission and image quality.' },
    related: ['lens', 'cornea', 'iris', 'zonules'], sources: [DISEASE_SOURCES.M02],
    steps: [
      { question: { zh: '正常晶状体如何参与成像？', en: 'How does a clear lens contribute to vision?' }, body: { zh: '晶状体位于虹膜后方，正常时透明，与角膜共同将光线聚焦到视网膜。白内障是晶状体发生混浊，不是眼球表面长了一层膜。', en: 'The normally transparent lens lies behind the iris and works with the cornea to focus light on the retina. A cataract is clouding within the lens, not a film growing over the eye’s surface.' } },
      { question: { zh: '晶状体为什么会变混浊？', en: 'Why does the lens become cloudy?' }, body: { zh: '常见的年龄相关性白内障涉及晶状体蛋白改变和聚集，使透明度下降、光散射增加。其他原因也可导致白内障。本例用均匀混浊说明机制，不区分混浊部位与类型；滑块仅控制显示强度。', en: 'Common age-related cataracts involve changes and clumping of lens proteins, reducing transparency and increasing light scattering. Cataracts also have other causes. Uniform clouding illustrates the mechanism here, without distinguishing locations or types; the slider controls display intensity only.' } },
      { question: { zh: '混浊怎样影响视觉质量？', en: 'How does clouding affect visual quality?' }, body: { zh: '白内障可导致视物模糊、对比敏感度下降、眩光、光晕或颜色变淡，表现因混浊部位和程度而异。本例固定屈光参数以突出散射；实际白内障还可能改变屈光状态，因此不能将其等同于单纯失焦。', en: 'Cataracts can cause blurred vision, reduced contrast sensitivity, glare, halos or faded colors; effects vary with the location and extent of clouding. Refraction is held fixed here to highlight scattering. Real cataracts may also change refraction, so they cannot be equated with defocus alone.' } }, optionalStep,
    ],
  },
  glaucoma: {
    ...metadata, id: 'glaucoma', name: { zh: '青光眼', en: 'Glaucoma' }, tag: { zh: '单眼 · 房水与视神经', en: 'Single eye · aqueous humor and optic nerve' },
    goal: { zh: '一组损害视神经的疾病；眼压是重要风险因素。', en: 'A group of diseases that damage the optic nerve; eye pressure is an important risk factor.' },
    related: ['ciliary-body', 'posterior-chamber', 'pupil', 'anterior-chamber', 'iridocorneal-angle', 'trabecular-meshwork', 'optic-disc', 'optic-nerve'], sources: [DISEASE_SOURCES.M03, DISEASE_SOURCES.M04, DISEASE_SOURCES.M17, DISEASE_SOURCES.M11, DISEASE_SOURCES.M15],
    steps: [
      { question: { zh: '房水与视神经各有什么作用？', en: 'What do aqueous humor and the optic nerve do?' }, body: { zh: '睫状突产生房水，房水经后房、瞳孔到前房，再主要经小梁网、Schlemm 管和下游静脉流出。视网膜神经节细胞的轴突汇集形成视神经，传递视觉信息；房水不沿视神经流出。', en: 'Ciliary processes produce aqueous humor. It passes through the posterior chamber and pupil into the anterior chamber, then drains mainly through the trabecular meshwork, Schlemm’s canal and downstream veins. Retinal ganglion-cell axons form the optic nerve and carry visual information; aqueous humor does not drain along it.' } },
      { question: { zh: '眼压升高与青光眼有什么关系？', en: 'How is elevated eye pressure related to glaucoma?' }, body: { zh: '青光眼性损害涉及视网膜神经节细胞及其轴突丢失，可伴视网膜神经纤维层变薄和视盘改变。眼压升高是重要、可干预的风险因素，但高眼压不等于青光眼，正常范围眼压也不能排除。本章侧重开角型相关机制；不演示虹膜阻塞房角的闭角机制。四种情景互相独立，不是病程阶段。', en: 'Glaucomatous damage involves loss of retinal ganglion cells and their axons, with retinal nerve-fiber layer thinning and optic-disc changes. Elevated eye pressure is an important, modifiable risk factor, but does not by itself establish glaucoma; normal-range pressure does not rule it out. This chapter focuses on mechanisms relevant to open-angle glaucoma, not angle closure by the iris. The four scenarios are independent, not disease stages.' } },
      { question: { zh: '没有症状，是否就没有损害？', en: 'Does having no symptoms mean there is no damage?' }, body: { zh: '开角型青光眼早期常无明显自觉症状，视野损害可在本人察觉前出现。降低眼压有助于减缓损害进展，但不能逆转已发生的青光眼性视功能丧失。结构检查与视野检查互为补充；下图仅示一种可能缺损，不是分期、检查结果或患者实际所见。', en: 'Early open-angle glaucoma often has no noticeable symptoms; field loss can occur before a person notices it. Lowering eye pressure helps slow progression but cannot reverse established glaucomatous vision loss. Structural and visual-field examinations provide complementary information. The diagram illustrates one possible defect, not a stage, test result or an individual’s view.' } }, optionalStep,
    ],
  },
  strabismus: {
    ...metadata, id: 'strabismus', name: { zh: '斜视', en: 'Strabismus' }, tag: { zh: '双眼 · 注视方向', en: 'Both eyes · gaze alignment' },
    goal: { zh: '双眼眼位不一致，可影响双眼单视与立体视觉。', en: 'Misalignment of the eyes can affect binocular single vision and depth perception.' },
    related: ['cornea', 'pupil', 'retina'], sources: [DISEASE_SOURCES.M06, DISEASE_SOURCES.M13, DISEASE_SOURCES.M14],
    steps: [
      { question: { zh: '双眼怎样共同注视？', en: 'How do the eyes fixate together?' }, body: { zh: '双眼协调注视同一目标，有助于将两眼图像融合为一个知觉，并形成精细立体视觉。看近时正常会聚使两眼向鼻侧转，方向线不平行并不等于内斜视；这里沿用成人双眼几何。', en: 'Coordinated fixation on one target supports fusion of the two images into a single percept and fine stereoscopic depth perception. Normal convergence turns both eyes nasally for near viewing; nonparallel gaze lines do not by themselves indicate esotropia. Adult binocular geometry is used here.' } },
      { question: { zh: '什么是斜视，偏斜方向如何判断？', en: 'What is strabismus, and how is its direction described?' }, body: { zh: '斜视是双眼眼位不一致，不能同时对准同一目标。内斜指向鼻侧偏，外斜指向颞侧偏；也有垂直等类型，本模型仅演示水平偏斜。斜视可涉及眼球运动控制、屈光或机械限制等因素，不能一概解释为眼外肌无力。', en: 'Strabismus is misalignment in which the eyes do not fixate the same target together. Esotropia is inward (nasal) deviation; exotropia is outward (temporal) deviation. Vertical and other forms also exist; this model shows horizontal deviation only. Eye-movement control, refraction or mechanical restrictions may contribute, so strabismus cannot simply be attributed to weak eye muscles.' } },
      { question: { zh: '为什么有人复视，有人不复视？', en: 'Why do some people have double vision while others do not?' }, body: { zh: '眼位不一致可干扰双眼单视与立体视觉。成人新出现的斜视常伴复视；儿童视觉系统可能抑制偏斜眼的信息，长期异常输入可与弱视相关。但复视、抑制和弱视并非所有斜视都会出现，也不是同一概念。下方情境只说明可能机制，不预测个人体验。', en: 'Misalignment can disrupt binocular single vision and stereopsis. Newly acquired strabismus in adults often causes double vision. A child’s visual system may suppress input from the deviating eye, and persistent abnormal input can be associated with amblyopia. Double vision, suppression and amblyopia are distinct and do not occur in every case. The contexts below illustrate possibilities, not an individual’s predicted experience.' } }, optionalStep,
    ],
  },
  amblyopia: {
    ...metadata, id: 'amblyopia', name: { zh: '弱视', en: 'Amblyopia' }, tag: { zh: '双眼输入 · 视觉发育', en: 'Binocular input · visual development' },
    goal: { zh: '发育期异常视觉经验导致最佳矫正视力降低。', en: 'Abnormal visual experience during development reduces best-corrected visual acuity.' },
    related: ['lens', 'retina', 'optic-nerve'], sources: [DISEASE_SOURCES.M16, DISEASE_SOURCES.M05, DISEASE_SOURCES.M12, DISEASE_SOURCES.M06, DISEASE_SOURCES.M02],
    steps: [
      { question: { zh: '正常视觉发育需要什么？', en: 'What supports normal visual development?' }, body: { zh: '儿童视觉发育依赖清晰、适宜的视觉输入。弱视是发育期异常视觉经验所致的一眼或双眼最佳矫正视力降低，不能单用眼部结构异常解释；不是不努力看，也不等同于眼球变小。此处先看正常输入，几何沿用成人模型。', en: 'Visual development in childhood depends on clear, appropriate visual input. Amblyopia is reduced best-corrected visual acuity in one or both eyes due to abnormal visual experience during development, not fully explained by structural abnormalities of the eye. It is not a lack of effort or simply a smaller eye. This reference shows normal input using adult eye geometry.' } },
      { question: { zh: '哪些异常视觉输入可导致弱视？', en: 'Which abnormal visual inputs can lead to amblyopia?' }, body: { zh: '未充分矫正的屈光参差可使两眼成像清晰度不等；斜视可造成双眼信息不一致与抑制；白内障等遮挡视轴可引起形觉剥夺。双眼高度未矫正屈光不正也可导致双眼弱视。以下只演示前三种单眼案例；有这些风险因素不等于已经确诊弱视。', en: 'Inadequately corrected anisometropia can produce unequal image clarity; strabismus can cause conflicting binocular input and suppression; obstruction of the visual axis, such as a cataract, can cause form deprivation. High uncorrected refractive error in both eyes can also cause bilateral amblyopia. The examples below show only the first three unilateral cases; these risk factors alone do not establish an amblyopia diagnosis.' } },
      { question: { zh: '改善输入后，视功能会怎样变化？', en: 'How can visual function change after input improves?' }, body: { zh: '弱视可通过适当干预改善，通常越早处理效果越好，较大儿童也可能获益。屈光矫正本身可使部分患儿视力逐渐提高；是否还需其他治疗取决于专业评估。输入变清晰、眼位回正或解除遮挡，不等于已即时恢复视力；本图不模拟治疗时间或预后。', en: 'Amblyopia can improve with appropriate treatment, usually with better outcomes when addressed earlier; older children may also benefit. Optical correction alone can gradually improve acuity in some children; assessment determines whether further treatment is needed. Clearer input, realignment or removal of an obstruction does not establish immediate recovery of acuity. This diagram does not model treatment time or prognosis.' } }, optionalStep,
    ],
  },
};

export const DISEASE_TEXT = {
  chapters: { zh: '选择眼病主题', en: 'Choose an eye condition' },
  optional: { zh: '按讲解需要直接选择主题和环节；理解确认可选。', en: 'Choose any topic or section for the explanation; questions are optional.' },
  related: { zh: '了解相关结构', en: 'About related structures' },
  close: { zh: '关闭结构资料，返回本章', en: 'Close anatomy details and return to this chapter' },
  normal: { zh: '正常参考', en: 'Normal reference' },
  variation: { zh: '变化示意', en: 'Illustrated change' },
  compare: { zh: '正常与变化对照', en: 'Compare normal and changed' },
  compareHint: { zh: '保持镜头与观察条件一致；双眼章节始终显示同一对眼。', en: 'Camera and viewing conditions stay matched; binocular chapters always show one pair of eyes.' },
  reset: { zh: '重置本章示意', en: 'Reset chapter illustration' },
  resetNote: { zh: '重新演示，不表示临床恢复；理解确认记录保留。', en: 'Restarts the illustration, not clinical recovery; question records are kept.' },
  leave: { zh: '返回原工作区', en: 'Return to previous workspace' },
  sources: { zh: '来源与内容状态', en: 'Sources and content status' },
  pending: { zh: '医学内容待专家审核', en: 'Medical content awaits expert review' },
  translationDraft: { zh: '中英文待独立审校', en: 'Chinese and English await independent review' },
  translationChecked: { zh: '中英文已作独立 LLM 审校', en: 'Chinese and English independently checked by an LLM' },
  right: { zh: '右眼 OD', en: 'Right eye OD' }, left: { zh: '左眼 OS', en: 'Left eye OS' },
  both: { zh: '双眼 OD · OS', en: 'Both eyes OD · OS' },
  selectEye: { zh: '选择观察眼侧', en: 'Select eye to inspect' },
  locateLens: { zh: '定位晶状体', en: 'Locate lens' },
  lensDetail: { zh: '晶状体局部', en: 'Lens detail' }, contextView: { zh: '眼球内位置', en: 'Location in the eye' },
  opacity: { zh: '混浊示意强度', en: 'Illustrative clouding intensity' },
  opacityHint: { zh: '0—1 仅是显示强度，不是白内障分期或视力值。', en: '0–1 controls display intensity only, not cataract stage or visual acuity.' },
  testChart: { zh: '本地对比图', en: 'Local contrast chart' }, glareScene: { zh: '点光源场景', en: 'Point-light scene' },
  cataractPreview: { zh: '透光与散射定性示意', en: 'Qualitative transmission and scattering illustration' },
  cataractPreviewNote: { zh: '使用同一测试图：变化预览采用当前模型的混浊参数，正常参考保持清晰。雾感、对比度和光晕只用于说明，不是视力检查或患者实际所见。', en: 'Both views use the same chart: the changed preview uses the model’s current clouding parameter, while the normal reference stays clear. Haze, contrast and halos illustrate a mechanism, not a vision test or an individual’s actual view.' },
  outflow: { zh: '房水流出位置', en: 'Aqueous outflow view' }, nerve: { zh: '眼底与视神经位置', en: 'Fundus and optic nerve view' },
  scenario: { zh: '独立情景（不是病程）', en: 'Independent scenarios (not stages)' },
  scenarioNormal: { zh: '正常参考', en: 'Normal reference' }, scenarioRisk: { zh: '流出受限 · 风险', en: 'Restricted outflow · risk' },
  scenarioDamage: { zh: '已有损害示例', en: 'Example with existing damage' }, scenarioTension: { zh: '正常眼压损害示例', en: 'Damage with normal-range pressure' },
  riskOnly: { zh: '本例只表现流出风险，视神经仍保留参考外观；不是已经确诊损害。', en: 'This example illustrates outflow-related risk while retaining the reference nerve appearance; it does not establish damage.' },
  damagePersists: { zh: '已有损害示意保留：改善流出不等于已损伤部分再生。', en: 'Existing damage remains illustrated: better outflow does not regenerate damaged tissue.' },
  normalTension: { zh: '本例不显示眼压升高，但单独保留损害示意。正常眼压不能单独排除青光眼。', en: 'This example shows no elevated pressure but separately retains damage. Normal-range pressure alone does not rule out glaucoma.' },
  relieve: { zh: '解除本例流出受限（概念演示）', en: 'Relieve this example’s outflow restriction (concept)' },
  relieved: { zh: '本例流出已改善', en: 'Outflow improved in this example' },
  flow: { zh: '房水路线（青绿色箭头）', en: 'Aqueous route (teal arrows)' },
  flowRoute: { zh: '睫状突 → 后房 → 瞳孔 → 前房 → 房角小梁网 → Schlemm 管 → 集液管 → 巩膜表层静脉', en: 'Ciliary processes → posterior chamber → pupil → anterior chamber → trabecular meshwork at the angle → Schlemm’s canal → collector channels → episcleral veins' },
  flowNote: { zh: '文字列出主要的小梁网流出途径；三维箭头仅画到小梁网，下游管道未建模。另有葡萄膜巩膜途径。箭头不是光线或血流，速度变化不计算眼压。', en: 'The text lists the main trabecular outflow pathway. The 3D arrows stop at the meshwork; downstream channels are not modeled. A uveoscleral pathway also exists. Arrows are not light or blood flow, and their speed does not calculate eye pressure.' },
  field: { zh: '视野范围示意图', en: 'Visual field illustration' }, early: { zh: '早期开角型青光眼可无自觉症状；这不等于没有视野损害。', en: 'Early open-angle glaucoma may have no noticeable symptoms; this does not mean there is no field loss.' }, defect: { zh: '可能的局部缺损例子', en: 'Example of a possible local defect' },
  fieldReference: { zh: '未标注缺损的参考图', en: 'Reference without a marked defect' },
  fieldNote: { zh: '未标注缺损的图只是绘图参考，不代表早期青光眼视野正常。斜线仅标记一种局部缺损，不表示患者必然看到黑块。两图不构成病程或检查结果。', en: 'The unmarked diagram is a drawing reference, not evidence of a normal field in early glaucoma. Hatching marks one possible local defect, not a black patch a person necessarily sees. The two diagrams are neither disease stages nor test results.' },
  fixation: { zh: '注视点', en: 'Fixation' }, fieldDefect: { zh: '缺损例子', en: 'Example defect' },
  structureNote: { zh: '较少的连续线条表示神经纤维丢失，不表示纤维被切断；线条数不是轴突计数或损害比例。未模拟视盘凹陷、纤维层厚度或其与视野的定量关系。', en: 'Fewer continuous lines illustrate nerve-fiber loss, not severed fibers. Line counts are not axon counts or a damage percentage. Disc cupping, nerve-fiber layer thickness and quantitative links to the visual field are not modeled.' },
  alignment: { zh: '眼位示意', en: 'Alignment illustration' }, aligned: { zh: '共同对准', en: 'Aligned to target' }, esotropia: { zh: '内斜示意', en: 'Esotropia example' }, exotropia: { zh: '外斜示意', en: 'Exotropia example' }, custom: { zh: '自定偏差', en: 'Custom deviation' },
  affectedEye: { zh: '偏斜眼', en: 'Deviating eye' }, deviation: { zh: '额外水平偏差（示意角度）', en: 'Additional horizontal deviation (illustrative angle)' },
  deviationNote: { zh: '正值向鼻侧，负值向颞侧；不是临床分级、棱镜度或治疗量。', en: 'Positive is nasal, negative temporal; these are not clinical grades, prism diopters or treatment amounts.' },
  target: { zh: '共同注视目标', en: 'Shared fixation target' }, far: { zh: '较远', en: 'Farther' }, near: { zh: '较近', en: 'Nearer' },
  showAxes: { zh: '显示简化注视方向线', en: 'Show simplified gaze lines' },
  convergenceNote: { zh: '正常看近时两眼会聚，仍对准同一目标；方向线不必平行。', en: 'Normal near viewing involves convergence while both eyes remain aligned to the same target; the lines need not be parallel.' },
  visualContext: { zh: '选择讲解情境', en: 'Choose an explanatory context' },
  alignmentOnly: { zh: '只讲眼位', en: 'Alignment only' }, adultDiplopia: { zh: '成人可能复视', en: 'Possible adult double vision' }, childSuppression: { zh: '儿童可能抑制', en: 'Possible childhood suppression' },
  alignmentBody: { zh: '先比较两眼相对目标的方向。眼位几何本身不决定每个人的视觉体验。', en: 'Compare each eye’s direction relative to the target. Geometry alone does not determine an individual’s visual experience.' },
  diplopiaBody: { zh: '分离标记表示同一目标可能被感为两个像，间距只是示意；并非所有斜视都会复视。', en: 'Separated markers illustrate possible double vision of one target; their spacing is schematic. Not all strabismus causes double vision.' },
  suppressionBody: { zh: '儿童期斜视可使视觉系统抑制偏斜眼的信息，以减少双眼视觉冲突；这种感觉适应不是视神经被阻断。它可伴立体视觉受损或弱视，但并非每名儿童都会出现。', en: 'With childhood strabismus, the visual system may suppress input from the deviating eye to reduce binocular conflict. This sensory adaptation is not a blocked optic nerve. It can accompany impaired stereopsis or amblyopia, but does not occur in every child.' },
  developmentalLink: { zh: '了解视觉发育影响', en: 'Explore effects on visual development' },
  developmentNote: { zh: '儿童视觉发育机制示意；眼部几何沿用成人模型。', en: 'Childhood visual-development illustration using adult eye geometry.' },
  cause: { zh: '致病机制案例', en: 'Mechanism example' }, anisometropia: { zh: '屈光参差', en: 'Anisometropia' }, strabismic: { zh: '斜视相关', en: 'Strabismus related' }, deprivation: { zh: '形觉剥夺', en: 'Form deprivation' },
  mechanismCause: { zh: '原因', en: 'Cause' }, mechanismInput: { zh: '发育期输入异常', en: 'Abnormal input during development' }, mechanismOutcome: { zh: '已形成的视觉功能问题', en: 'Established visual-function problem' },
  anisometropiaBody: { zh: '双眼屈光度不同，未充分矫正时可使一眼持续接收较模糊图像，即使眼位整齐也可能形成弱视。本例用右眼近视解释成像差异；远视或散光差异也可能致病，并非只有近视。', en: 'Different refractive errors can leave one eye with a persistently blurrier image when inadequately corrected, even with straight eyes. Right-eye myopia illustrates the image difference here; differences in hyperopia or astigmatism can also cause amblyopia.' },
  strabismicBody: { zh: '本例改善眼位前屈光基准相同，但右眼偏离共同目标。发育期持续的双眼信息冲突与抑制可影响偏斜眼视力发育；斜视与弱视仍是不同诊断。', en: 'Before realignment in this example, refraction is matched but the right eye deviates from the shared target. Persistent binocular conflict and suppression during development can affect acuity development in that eye; strabismus and amblyopia remain distinct diagnoses.' },
  deprivationBody: { zh: '发育期白内障等遮挡视轴，使视网膜无法获得足够清晰的形觉刺激，可形成剥夺性弱视。本例以右眼晶状体混浊说明：混浊直接影响成像，弱视则是可能伴随的发育后果。', en: 'Obstruction of the visual axis during development, such as a cataract, deprives the retina of sufficiently clear patterned input and can cause deprivation amblyopia. Right-lens clouding illustrates the distinction: clouding directly degrades the image, while amblyopia is a possible developmental consequence.' },
  inputBody: { zh: '发育期输入的清晰度或双眼一致性异常，可能影响视觉功能的正常发育。', en: 'Abnormal clarity or binocular consistency of input during development can affect normal visual development.' },
  outcomeBody: { zh: '若已形成弱视，即使给予合适屈光矫正，视力也未达到相应发育水平；需结合视力、屈光、眼位和眼部检查评估，不能只凭这张输入图诊断。', en: 'In established amblyopia, acuity remains below the expected developmental level even with appropriate refractive correction. Assessment includes acuity, refraction, alignment and an eye examination; this input diagram alone cannot establish the diagnosis.' },
  recoveryBody: { zh: '改善输入为视觉发育与康复创造条件，视力可随适当干预逐步提高。是否恢复、恢复多少需随访评估；这里既不表示已经恢复，也不表示损害永久不可改善。', en: 'Better input supports visual development and rehabilitation, and acuity can improve with appropriate treatment over time. Whether and how much vision recovers requires reassessment; this view indicates neither completed recovery nor permanently unchangeable impairment.' },
  improveOptics: { zh: '改善光学输入（原理示意）', en: 'Improve optical input (principle)' }, improveAlignment: { zh: '眼位回正的几何示意', en: 'Geometric illustration of realignment' }, improveDeprivation: { zh: '解除输入遮挡的概念示意', en: 'Conceptual removal of input obstruction' },
  inputImproved: { zh: '输入已改善（示意）', en: 'Input improved (illustration)' }, inputBaseline: { zh: '本例异常输入', en: 'Abnormal input in this example' },
  processing: { zh: '视觉处理', en: 'Visual processing' }, developmentResult: { zh: '已形成弱视的情景', en: 'Scenario with established amblyopia' }, recoveryAssessment: { zh: '视觉恢复需随访评估', en: 'Recovery needs reassessment' }, normalInput: { zh: '正常输入基准', en: 'Normal-input reference' },
  neuralLegend: { zh: '紫色虚线：神经信息；不是入眼光线。', en: 'Purple dashed lines: neural information, not incoming light.' },
  amblyopiaLimit: { zh: '默认仅演示右眼输入差异；弱视也可能影响双眼。图示不复现所有人的实际视觉。', en: 'The default illustrates right-eye input differences only; amblyopia can affect both eyes. The diagram does not reproduce everyone’s visual experience.' },
} satisfies Record<string, Localized>;
