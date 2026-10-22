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
    goal: { zh: '认识晶状体混浊，区分散射与单纯失焦。', en: 'Locate lens clouding and distinguish scattering from defocus.' },
    related: ['lens', 'cornea', 'iris', 'zonules'], sources: [DISEASE_SOURCES.M02],
    steps: [
      { question: { zh: '晶状体在眼球哪里？', en: 'Where is the crystalline lens?' }, body: { zh: '晶状体位于虹膜后方，与前方角膜共同帮助光线聚焦。这里先显示清澈晶状体及其邻近结构。', en: 'The lens lies behind the iris and works with the cornea in front to focus light. Start with a clear lens and its neighboring structures.' } },
      { question: { zh: '晶状体混浊改变了什么？', en: 'What changes when the lens becomes cloudy?' }, body: { zh: '白内障指晶状体混浊。调节本例的显示强度，观察透光与散射示意；不会改变角膜、瞳孔开口或眼轴。', en: 'Cataract means clouding of the lens. Adjust the display intensity to explore transmission and scattering; the cornea, pupil opening and axial length stay fixed.' } },
      { question: { zh: '焦点相同，视觉质量也一定相同吗？', en: 'Does the same focus guarantee the same image quality?' }, body: { zh: '混浊可带来雾感、对比度下降或光源周围光晕。本例固定屈光参数来单独解释散射；现实白内障也可能伴随屈光变化，未在此模拟。', en: 'Clouding can cause haze, reduced contrast or halos around lights. This example holds refraction fixed to explain scattering separately; cataracts can also involve refractive changes, which are not simulated here.' } }, optionalStep,
    ],
  },
  glaucoma: {
    ...metadata, id: 'glaucoma', name: { zh: '青光眼', en: 'Glaucoma' }, tag: { zh: '单眼 · 房水与视神经', en: 'Single eye · aqueous humor and optic nerve' },
    goal: { zh: '区分眼压风险与视神经损害，理解已有损害不会因改善流出而消失。', en: 'Separate pressure-related risk from optic nerve damage, which does not disappear when outflow improves.' },
    related: ['ciliary-body', 'posterior-chamber', 'pupil', 'anterior-chamber', 'iridocorneal-angle', 'trabecular-meshwork', 'optic-disc', 'optic-nerve'], sources: [DISEASE_SOURCES.M03, DISEASE_SOURCES.M04, DISEASE_SOURCES.M11, DISEASE_SOURCES.M15],
    steps: [
      { question: { zh: '房水怎么流动，视神经在哪里？', en: 'Where does aqueous humor flow, and where is the optic nerve?' }, body: { zh: '睫状突产生房水，房水经后房、瞳孔到前房，再经房角的小梁网路线流出。视神经传递神经信息；房水不沿视神经流出。', en: 'Ciliary processes produce aqueous humor, which passes through the posterior chamber and pupil into the anterior chamber, then drains through the trabecular route at the angle. The optic nerve carries neural information, not aqueous outflow.' } },
      { question: { zh: '眼压风险与损害是一回事吗？', en: 'Is pressure-related risk the same as damage?' }, body: { zh: '四个独立情景用于比较机制，不是病程阶段。流出受限可能使眼压升高；高眼压不单独等于青光眼，正常范围的眼压也不能单独排除青光眼。', en: 'Four independent scenarios compare mechanisms; they are not disease stages. Restricted outflow can raise eye pressure. High pressure alone does not establish glaucoma, and pressure in the normal range alone does not rule it out.' } },
      { question: { zh: '改善流出后，已有损害会消失吗？', en: 'Does improving outflow remove existing damage?' }, body: { zh: '青光眼涉及视神经损害，早期可能没有明显自觉症状。降低眼压可帮助保护视功能，但不会让已有视功能损害自动恢复。视野图只举一个缺损例子。', en: 'Glaucoma involves optic nerve damage and may have no noticeable symptoms early on. Lowering pressure can help protect vision, but does not automatically restore vision already lost. The field diagram shows just one example of a defect.' } }, optionalStep,
    ],
  },
  strabismus: {
    ...metadata, id: 'strabismus', name: { zh: '斜视', en: 'Strabismus' }, tag: { zh: '双眼 · 注视方向', en: 'Both eyes · gaze alignment' },
    goal: { zh: '围绕共同目标区分正常会聚、内斜与外斜。', en: 'Use a shared target to distinguish convergence, esotropia and exotropia.' },
    related: ['cornea', 'pupil', 'retina'], sources: [DISEASE_SOURCES.M06, DISEASE_SOURCES.M13, DISEASE_SOURCES.M14],
    steps: [
      { question: { zh: '两眼是否共同对准目标？', en: 'Are both eyes aligned with the same target?' }, body: { zh: '正常看近时，两眼会聚以共同对准目标。不能仅凭方向线不平行就称为内斜视；这里用成人双眼几何说明空间关系。', en: 'During normal near viewing, the eyes converge to align with the same target. Nonparallel gaze lines alone do not mean esotropia. Adult binocular geometry illustrates this spatial relationship.' } },
      { question: { zh: '偏斜眼朝鼻侧还是颞侧？', en: 'Does the deviating eye turn nasally or temporally?' }, body: { zh: '本例内斜为偏斜眼相对正常注视方向向鼻侧转，外斜为向颞侧转。左右眼的屏幕方向会变化，应依据患者的鼻颞方位。', en: 'Here, esotropia turns the deviating eye nasally from its normal gaze direction; exotropia turns it temporally. Screen directions vary with eye side and view, so use the patient’s nasal and temporal directions.' } },
      { question: { zh: '眼位不一致一定引起复视吗？', en: 'Does misalignment always cause double vision?' }, body: { zh: '眼位、成人可能复视、儿童可能抑制是不同讲解情境。不是所有斜视都会复视，也不是所有儿童都会抑制或弱视；斜视还涉及眼球运动协调，不能只解释成肌肉无力。', en: 'Alignment, possible adult double vision and possible childhood suppression are separate explanatory contexts. Strabismus does not always cause double vision, nor do all children develop suppression or amblyopia. Eye-movement coordination matters; muscle weakness alone is not a complete explanation.' } }, optionalStep,
    ],
  },
  amblyopia: {
    ...metadata, id: 'amblyopia', name: { zh: '弱视', en: 'Amblyopia' }, tag: { zh: '双眼输入 · 视觉发育', en: 'Binocular input · visual development' },
    goal: { zh: '区分眼部输入问题与视觉发育结果，理解眼位整齐也可能有弱视。', en: 'Separate abnormal ocular input from its developmental effects; aligned eyes do not rule out amblyopia.' },
    related: ['lens', 'retina', 'optic-nerve'], sources: [DISEASE_SOURCES.M05, DISEASE_SOURCES.M12, DISEASE_SOURCES.M06, DISEASE_SOURCES.M02],
    steps: [
      { question: { zh: '双眼输入怎样参与视觉发育？', en: 'How do signals from both eyes support visual development?' }, body: { zh: '视觉系统在儿童期发育，并利用双眼传入的信息。此处先看正常输入基准；眼部几何沿用成人模型，不代表儿童眼球尺寸。', en: 'The visual system develops in childhood using information from both eyes. Start with a normal-input reference. The eye geometry uses an adult model and does not represent childhood eye dimensions.' } },
      { question: { zh: '不同原因怎样影响发育期输入？', en: 'How can different causes affect input during development?' }, body: { zh: '屈光参差、斜视与视觉输入受限是三种不同原因示例。原因、异常输入、发育结果可分别查看；这些卡片不是年龄或治疗时间轴。', en: 'Anisometropia, strabismus and restricted visual input illustrate three different causes. Explore cause, abnormal input and developmental outcome separately; the cards are not an age or treatment timeline.' } },
      { question: { zh: '改善输入是否等于即时恢复视功能？', en: 'Does improved input mean immediate recovery of visual function?' }, body: { zh: '输入变清晰或眼位回正，与已形成的视觉发育问题是两个层次。改善输入后处理框仍保留发育结果。弱视常影响一眼，也可能影响双眼；它不是患者不努力看。', en: 'Clearer input or straighter eyes are distinct from an established visual-development problem. The processing box retains the developmental outcome after input improves. Amblyopia usually affects one eye but can affect both; it is not a lack of effort to see.' } }, optionalStep,
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
  flowRoute: { zh: '睫状突 → 后房 → 瞳孔 → 前房 → 房角小梁网', en: 'Ciliary processes → posterior chamber → pupil → anterior chamber → trabecular meshwork at the angle' },
  flowNote: { zh: '仅展示小梁网流出路线；另有其他途径。箭头不是光线、血流，也不计算眼压。', en: 'Only the trabecular outflow route is shown; other routes exist. Arrows are neither light nor blood flow and do not calculate eye pressure.' },
  field: { zh: '视野范围示意图', en: 'Visual field illustration' }, early: { zh: '早期可能无明显自觉变化', en: 'Early: possibly no noticeable change' }, defect: { zh: '可能的局部缺损例子', en: 'Example of a possible local defect' },
  fieldNote: { zh: '斜线标记一个局部缺损例子，不表示眼前必然出现黑块。实际形态与主观感受各异，不能据此诊断或预测。', en: 'Hatching marks one local defect example, not a black patch everyone sees. Patterns and subjective experience vary; this cannot diagnose or predict a field defect.' },
  fixation: { zh: '注视点', en: 'Fixation' }, fieldDefect: { zh: '缺损例子', en: 'Example defect' },
  structureNote: { zh: '视盘与视神经结构为示意，不能据此诊断；与视野图无定量预测关系。', en: 'The disc and nerve are structural illustrations, not diagnostic criteria; they do not quantitatively predict the field diagram.' },
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
  suppressionBody: { zh: '儿童期眼位不一致时，视觉系统可能抑制一眼信息，并可能影响发育；不是所有儿童都如此。', en: 'With childhood misalignment, the visual system may suppress information from one eye, potentially affecting development; this does not happen in every child.' },
  developmentalLink: { zh: '了解视觉发育影响', en: 'Explore effects on visual development' },
  developmentNote: { zh: '儿童视觉发育机制示意；眼部几何沿用成人模型。', en: 'Childhood visual-development illustration using adult eye geometry.' },
  cause: { zh: '原因案例', en: 'Cause example' }, anisometropia: { zh: '屈光参差', en: 'Anisometropia' }, strabismic: { zh: '斜视相关', en: 'Strabismus related' }, deprivation: { zh: '视觉输入受限', en: 'Restricted visual input' },
  mechanismCause: { zh: '原因', en: 'Cause' }, mechanismInput: { zh: '发育期输入异常', en: 'Abnormal input during development' }, mechanismOutcome: { zh: '已形成的视觉功能问题', en: 'Established visual-function problem' },
  anisometropiaBody: { zh: '双眼眼位对准，但屈光状态不同，右眼输入示意较不清晰；没有晶状体混浊。', en: 'The eyes are aligned but have different refractive states, with a less clear right-eye input illustration; there is no lens clouding.' },
  strabismicBody: { zh: '本例两眼屈光基准相同，右眼偏离目标，双眼信息不一致；可能发生抑制。', en: 'Both eyes share the same refractive baseline, but the right eye deviates, making their information inconsistent; suppression may occur.' },
  deprivationBody: { zh: '本例两眼对准，右眼晶状体混浊限制输入；混浊原因与弱视发育结果是不同概念。', en: 'Both eyes are aligned, but right-lens clouding limits input; the clouding and the developmental outcome of amblyopia are different concepts.' },
  inputBody: { zh: '发育期输入的清晰度或双眼一致性异常，可能影响视觉功能的正常发育。', en: 'Abnormal clarity or binocular consistency of input during development can affect normal visual development.' },
  outcomeBody: { zh: '已形成的发育问题需专业评估，不能由改善输入的概念开关表示即时恢复。', en: 'An established developmental problem needs professional assessment; an input-improvement switch cannot represent immediate recovery.' },
  improveOptics: { zh: '改善光学输入（原理示意）', en: 'Improve optical input (principle)' }, improveAlignment: { zh: '眼位回正的几何示意', en: 'Geometric illustration of realignment' }, improveDeprivation: { zh: '解除输入遮挡的概念示意', en: 'Conceptual removal of input obstruction' },
  inputImproved: { zh: '输入已改善（示意）', en: 'Input improved (illustration)' }, inputBaseline: { zh: '本例异常输入', en: 'Abnormal input in this example' },
  processing: { zh: '视觉处理', en: 'Visual processing' }, developmentResult: { zh: '发育结果仍保留', en: 'Developmental outcome retained' }, normalInput: { zh: '正常输入基准', en: 'Normal-input reference' },
  neuralLegend: { zh: '紫色虚线：神经信息；不是入眼光线。', en: 'Purple dashed lines: neural information, not incoming light.' },
  amblyopiaLimit: { zh: '默认仅演示右眼输入差异；弱视也可能影响双眼。图示不复现所有人的实际视觉。', en: 'The default illustrates right-eye input differences only; amblyopia can affect both eyes. The diagram does not reproduce everyone’s visual experience.' },
} satisfies Record<string, Localized>;
