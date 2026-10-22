import { STRUCTURES } from '../anatomy/data';
import type { Localized, StructureId } from '../anatomy/types';
import { messages } from './messages';

export type QuestionContext = 'structures' | 'anatomy' | 'vision' | 'myopia';
export type Question = {
  id: string; context: QuestionContext; kind: 'identify' | 'concept'; prompt: Localized;
  target: StructureId | null;
  options: { id: string; label: Localized; feedback: Localized }[];
  correctOptionId: string; sources: string[]; reviewStatus: 'draft' | 'llm-checked';
};
export const CONTENT_VERSION = '2026-10-22-t07';
const identificationIds: StructureId[] = ['cornea', 'sclera', 'iris', 'lens', 'retina', 'optic-nerve'];
const identificationQuestions: Question[] = identificationIds.map(id => {
  const target = STRUCTURES.find(structure => structure.id === id)!;
  return {
    id, context: 'structures', kind: 'identify', prompt: messages.question, target: id,
    options: identificationIds.map(optionId => {
      const selected = STRUCTURES.find(structure => structure.id === optionId)!;
      return { id: optionId, label: selected.name, feedback: {
        zh: `${target.name.zh}：${target.summary.zh}${optionId === id ? '' : ` 你选的${selected.name.zh}：${selected.summary.zh}`}`,
        en: `${target.name.en}: ${target.summary.en}${optionId === id ? '' : ` Your choice, ${selected.name.en}: ${selected.summary.en}`}`,
      } };
    }),
    correctOptionId: id, sources: ['M01', 'M07'], reviewStatus: 'llm-checked',
  };
});

export const QUESTIONS: Question[] = [
  ...identificationQuestions,
  {
    id: 'anatomy-wall-order-01', context: 'anatomy', kind: 'concept', target: 'choroid',
    prompt: { zh: '眼球后部的壁，从外向内依次是哪三层？', en: 'Which order runs from outside to inside through the posterior eye wall?' },
    options: [
      { id: 'sclera-choroid-retina', label: { zh: '巩膜 → 脉络膜 → 视网膜', en: 'Sclera → choroid → retina' }, feedback: { zh: '巩膜在外，脉络膜位于中间，视网膜在内侧邻近玻璃体。', en: 'The sclera is outermost, the choroid lies between, and the retina is innermost beside the vitreous.' } },
      { id: 'retina-choroid-sclera', label: { zh: '视网膜 → 脉络膜 → 巩膜', en: 'Retina → choroid → sclera' }, feedback: { zh: '这个顺序是从内向外。题目要求从外向内，应从巩膜开始，经脉络膜到视网膜。', en: 'This runs from inside to outside. For outside to inside, start with the sclera, then the choroid and retina.' } },
      { id: 'sclera-retina-choroid', label: { zh: '巩膜 → 视网膜 → 脉络膜', en: 'Sclera → retina → choroid' }, feedback: { zh: '脉络膜在巩膜与视网膜之间，视网膜不会先于脉络膜出现在这条由外向内的路径上。', en: 'The choroid separates the sclera from the retina, so this outside-to-inside path reaches the choroid before the retina.' } },
    ], correctOptionId: 'sclera-choroid-retina', sources: ['M07'], reviewStatus: 'llm-checked',
  },
  {
    id: 'anatomy-chambers-02', context: 'anatomy', kind: 'concept', target: 'posterior-chamber',
    prompt: { zh: '医生指向“后房”时，指的是哪个空间？', en: 'Which space does a doctor mean by the posterior chamber?' },
    options: [
      { id: 'aqueous-behind-iris', label: { zh: '虹膜后方、晶状体及悬韧带前方的狭窄房水空间', en: 'The narrow aqueous space behind the iris and in front of the lens and zonules' }, feedback: { zh: '后房位于眼球前段，容纳房水；房水可经瞳孔进入前房。它与晶状体后方的玻璃体腔不同。', en: 'The posterior chamber is in the anterior segment and contains aqueous humor, which passes through the pupil into the anterior chamber. It differs from the vitreous chamber behind the lens.' } },
      { id: 'vitreous-cavity', label: { zh: '晶状体后方、充满玻璃体凝胶的大空间', en: 'The large space behind the lens filled with vitreous gel' }, feedback: { zh: '这是玻璃体腔。“后房”的“后”指虹膜后方的狭窄房水空间，不是眼球后部的大腔隙。', en: 'That is the vitreous chamber. The posterior chamber is the narrow aqueous space behind the iris, not the large cavity at the back of the eye.' } },
      { id: 'aqueous-before-iris', label: { zh: '角膜与虹膜之间的房水空间', en: 'The aqueous space between the cornea and iris' }, feedback: { zh: '这是前房。前房与后房都容纳房水，但位于虹膜的不同侧。', en: 'That is the anterior chamber. Both chambers contain aqueous humor, but they lie on different sides of the iris.' } },
    ], correctOptionId: 'aqueous-behind-iris', sources: ['M11'], reviewStatus: 'llm-checked',
  },
  {
    id: 'anatomy-fundus-03', context: 'anatomy', kind: 'concept', target: 'fovea',
    prompt: { zh: '中央凹、黄斑和视盘的位置关系，哪项正确？', en: 'Which statement correctly relates the fovea, macula and optic disc?' },
    options: [
      { id: 'fovea-macula-temporal', label: { zh: '中央凹在黄斑中央，黄斑在视盘颞侧', en: 'The fovea is at the macular center; the macula is temporal to the optic disc' }, feedback: { zh: '颞侧指靠近太阳穴的一侧。中央凹属于黄斑；黄斑与视盘是不同的眼底地标。', en: 'Temporal means toward the temple. The fovea belongs to the macula; the macula and optic disc are distinct fundus landmarks.' } },
      { id: 'fovea-disc-center', label: { zh: '中央凹在视盘中央，神经由中央凹离眼', en: 'The fovea is at the disc center, where the nerve leaves the eye' }, feedback: { zh: '神经纤维在视盘汇集离眼，中央凹则在黄斑中央。两处不能混为一谈。', en: 'Nerve fibers converge and leave at the optic disc; the fovea is at the center of the macula. These are different sites.' } },
      { id: 'macula-nasal', label: { zh: '黄斑在视盘鼻侧，中央凹在黄斑之外', en: 'The macula is nasal to the disc, and the fovea lies outside the macula' }, feedback: { zh: '方位和包含关系都颠倒了：黄斑在视盘颞侧，中央凹位于黄斑中央；鼻颞方向不由屏幕左右决定。', en: 'Both relationships are reversed: the macula is temporal to the disc and contains the central fovea. Nasal and temporal are anatomical directions, not screen left and right.' } },
    ], correctOptionId: 'fovea-macula-temporal', sources: ['M07'], reviewStatus: 'llm-checked',
  },
  {
    id: 'vision-pupil-01', context: 'vision', kind: 'concept', target: 'pupil',
    prompt: { zh: '光经过虹膜所在的平面时，主要从哪里通过？', en: 'At the plane of the iris, where does light pass through?' },
    options: [
      { id: 'pupil-opening', label: { zh: '虹膜中央的瞳孔开口', en: 'The pupil opening at the center of the iris' }, feedback: { zh: '瞳孔是开口，周围的虹膜肌肉调节它的大小；光从开口继续向晶状体传播。', en: 'The pupil is an opening whose size is controlled by the surrounding iris muscles. Light continues through it toward the lens.' } },
      { id: 'iris-tissue', label: { zh: '有颜色的虹膜组织本身', en: 'The colored iris tissue itself' }, feedback: { zh: '虹膜组织围绕并调节开口，正常入光路径经过的是瞳孔，不能把虹膜画成透明通道。', en: 'Iris tissue surrounds and controls the opening. The normal light path passes through the pupil, not through a transparent channel in the iris tissue.' } },
      { id: 'black-tissue', label: { zh: '瞳孔内的一块黑色组织', en: 'A piece of black tissue inside the pupil' }, feedback: { zh: '瞳孔看起来较暗，但它是开口，并没有一块用于透光的黑色实体组织。', en: 'The pupil appears dark, but it is an opening, not a solid black structure through which light travels.' } },
    ], correctOptionId: 'pupil-opening', sources: ['M01'], reviewStatus: 'llm-checked',
  },
  {
    id: 'vision-focus-02', context: 'vision', kind: 'concept', target: 'lens',
    prompt: { zh: '哪些结构共同帮助光线聚焦到视网膜？', en: 'Which structures work together to focus light on the retina?' },
    options: [
      { id: 'cornea-and-lens', label: { zh: '角膜与晶状体', en: 'The cornea and lens' }, feedback: { zh: '角膜和晶状体都参与折射。晶状体还能通过形状变化参与调节，但它不是唯一的屈光结构。', en: 'Both refract light. The lens also changes shape during accommodation, but it is not the only refracting structure.' } },
      { id: 'lens-only', label: { zh: '只有晶状体', en: 'Only the lens' }, feedback: { zh: '这遗漏了角膜的作用：光进入眼内时已被角膜折射，随后再经过晶状体。', en: 'This leaves out the cornea: light is already refracted there before it reaches the lens.' } },
      { id: 'retina-only', label: { zh: '只有视网膜', en: 'Only the retina' }, feedback: { zh: '视网膜负责感受光并转换、处理信号；把光聚焦到它的是前方的角膜与晶状体。', en: 'The retina detects light and converts and processes signals. The cornea and lens in front of it provide the focusing.' } },
    ], correctOptionId: 'cornea-and-lens', sources: ['M01'], reviewStatus: 'llm-checked',
  },
  {
    id: 'vision-signal-03', context: 'vision', kind: 'concept', target: 'optic-nerve',
    prompt: { zh: '光到达视网膜后，视觉信息怎样离开眼球？', en: 'After light reaches the retina, how does visual information leave the eye?' },
    options: [
      { id: 'retinal-neural-output', label: { zh: '视网膜转换和处理信号，再经视神经传出', en: 'The retina converts and processes signals, which then leave through the optic nerve' }, feedback: { zh: '感光细胞把光转换为信号；经视网膜处理后，神经节细胞轴突构成的视神经传递神经信号。', en: 'Photoreceptors convert light into signals. After retinal processing, neural signals travel through the optic nerve, formed by ganglion-cell axons.' } },
      { id: 'light-through-nerve', label: { zh: '同一束光沿视神经直接进入大脑', en: 'The same light beam travels through the optic nerve into the brain' }, feedback: { zh: '视神经不是导光管。它传递神经信号，因此演示用另一种线型和图例表示这段路径。', en: 'The optic nerve is not a light pipe. It carries neural signals, so the demonstration uses a different line style and legend for that path.' } },
      { id: 'conversion-in-pupil', label: { zh: '瞳孔先把光变成信号，视网膜只作通道', en: 'The pupil converts light into signals, while the retina only provides a passage' }, feedback: { zh: '瞳孔只是虹膜中央的开口；光的感受、转换和初步处理发生在视网膜。', en: 'The pupil is only the opening in the iris. Light detection, conversion and initial processing occur in the retina.' } },
    ], correctOptionId: 'retinal-neural-output', sources: ['M01', 'M07'], reviewStatus: 'llm-checked',
  },
  {
    id: 'myopia-axial-01', context: 'myopia', kind: 'concept', target: 'retina',
    prompt: { zh: '本例保持屈光能力不变，只延长眼轴，远处光线的焦点相对视网膜在哪里？', en: 'In this example, only axial length increases while refracting power stays fixed. Where is the focus of distant light relative to the retina?' },
    options: [
      { id: 'in-front', label: { zh: '视网膜前方', en: 'In front of the retina' }, feedback: { zh: '眼轴延长使视网膜后移，而本例的聚焦能力不变，所以焦点位于视网膜前。', en: 'Axial elongation moves the retina backward while focusing power stays fixed in this example, leaving the focus in front of it.' } },
      { id: 'behind', label: { zh: '视网膜后方', en: 'Behind the retina' }, feedback: { zh: '本例中后移的是视网膜，不是焦点；相对于新的视网膜位置，焦点在前方。', en: 'Here the retina moves backward, not the focus. Relative to the new retinal position, the focus is in front.' } },
      { id: 'on-retina', label: { zh: '始终跟着视网膜移动，仍在其表面', en: 'It follows the retina and remains on its surface' }, feedback: { zh: '这里没有自动调焦：只改变眼轴不会让焦点自动跟随视网膜。', en: 'There is no automatic refocusing here: changing axial length alone does not make the focus follow the retina.' } },
    ], correctOptionId: 'in-front', sources: ['M09'], reviewStatus: 'llm-checked',
  },
  {
    id: 'myopia-correction-02', context: 'myopia', kind: 'concept', target: 'retina',
    prompt: { zh: '本例如何让远处光线重新聚焦到延长眼轴后的视网膜？', en: 'How does this example refocus distant light on the retina after axial elongation?' },
    options: [
      { id: 'diverging-lens', label: { zh: '加入为本例求解的发散镜片', en: 'Add a diverging lens calculated for this example' }, feedback: { zh: '发散镜片改变入眼光线的方向，使本例的焦点后移至视网膜；眼轴并未因此缩短。', en: 'The diverging lens changes incoming ray directions, moving this example’s focus backward to the retina. It does not shorten the eye.' } },
      { id: 'converging-lens', label: { zh: '增加会聚作用，让光更早聚焦', en: 'Add convergence so the light focuses earlier' }, feedback: { zh: '本例的焦点已经在视网膜前，更早聚焦不能解决这个距离差；需要让焦点后移。', en: 'The focus is already in front of the retina. Earlier focusing does not resolve that gap; the focus needs to move backward.' } },
      { id: 'shorten-with-lens', label: { zh: '用镜片把眼轴直接缩回原长', en: 'Use the lens to physically shorten the eye' }, feedback: { zh: '镜片改变光路，不把眼球压短。本例矫正后仍保留延长的眼轴。', en: 'The lens changes the light path, not the physical length of the eye. Axial length remains increased after correction in this example.' } },
    ], correctOptionId: 'diverging-lens', sources: ['M09'], reviewStatus: 'llm-checked',
  },
  {
    id: 'myopia-limit-03', context: 'myopia', kind: 'concept', target: 'lens',
    prompt: { zh: '怎样理解这个轴性近视 demo 的适用范围？', en: 'How should this axial-myopia demo be interpreted?' },
    options: [
      { id: 'illustration-only', label: { zh: '解释一个机制，参数不是个人处方，也不覆盖全部近视成因', en: 'It explains one mechanism; its parameters are not a personal prescription, and it does not cover every cause of myopia' }, feedback: { zh: '本例使用归一化模型，只比较固定条件下的眼轴变化；个人屈光状态需要实际检查，不能从滑块读出处方。', en: 'This normalized model compares axial changes under fixed conditions. Individual refractive status requires an examination; slider values cannot provide a prescription.' } },
      { id: 'read-prescription', label: { zh: '把镜片参数直接作为验光度数', en: 'Read the lens parameter directly as a prescription power' }, feedback: { zh: '模型数值没有临床单位或个人测量依据，不能当作验光结果。', en: 'The model values have no clinical units or individual measurement basis and cannot be treated as a refraction result.' } },
      { id: 'all-myopia-axial', label: { zh: '所有近视都只有眼轴延长这一种原因', en: 'All myopia has axial elongation as its only cause' }, feedback: { zh: '本例只突出眼轴因素；角膜和晶状体的形态或屈光状态也可能参与近视，不能将一个示例推广为全部成因。', en: 'This example isolates axial length. Corneal and lens shape or refractive properties can also contribute to myopia, so one example does not cover every cause.' } },
    ], correctOptionId: 'illustration-only', sources: ['M09'], reviewStatus: 'llm-checked',
  },
];
export const questionById = (id: string) => QUESTIONS.find(question => question.id === id);
export const questionsFor = (context: QuestionContext) => QUESTIONS.filter(question => question.context === context);
