import { STRUCTURES } from '../anatomy/data';
import type { Localized, StructureId } from '../anatomy/types';
import { messages } from './messages';

export type QuestionContext = 'structures' | 'anatomy' | 'vision' | 'myopia' | 'cataract' | 'glaucoma' | 'strabismus' | 'amblyopia';
export type Question = {
  id: string; context: QuestionContext; kind: 'identify' | 'concept'; prompt: Localized;
  target: StructureId | null;
  options: { id: string; label: Localized; feedback: Localized }[];
  correctOptionId: string; sources: string[]; reviewStatus: 'draft' | 'llm-checked';
  contentVersion?: string; translationStatus?: 'draft' | 'llm-checked'; medicalReviewStatus?: 'pending' | 'expert-reviewed';
};
export const CONTENT_VERSION = '2026-10-22-diseases';
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
  {
    "id": "cat-location-01",
    "context": "cataract",
    "kind": "concept",
    "target": "lens",
    "prompt": {
      "zh": "白内障主要指哪一结构发生混浊？",
      "en": "Which structure becomes cloudy in cataract?"
    },
    "options": [
      {
        "id": "lens-clouding",
        "label": {
          "zh": "晶状体",
          "en": "The crystalline lens"
        },
        "feedback": {
          "zh": "白内障指晶状体混浊，晶状体位于虹膜后方。",
          "en": "Cataract means clouding of the lens, which lies behind the iris."
        }
      },
      {
        "id": "cornea-clouding",
        "label": {
          "zh": "角膜",
          "en": "The cornea"
        },
        "feedback": {
          "zh": "角膜位于虹膜前方，也可能混浊；但白内障特指后方晶状体的混浊。",
          "en": "The cornea lies in front of the iris and can also become cloudy, but cataract specifically means lens clouding behind it."
        }
      },
      {
        "id": "retina-clouding",
        "label": {
          "zh": "视网膜",
          "en": "The retina"
        },
        "feedback": {
          "zh": "视网膜在眼球内壁感受光。白内障的混浊发生在前方晶状体，不是视网膜。",
          "en": "The retina detects light along the inner eye wall. Cataract clouding occurs in the lens in front, not in the retina."
        }
      }
    ],
    "correctOptionId": "lens-clouding",
    "sources": [
      "M02"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "cat-mechanism-02",
    "context": "cataract",
    "kind": "concept",
    "target": "lens",
    "prompt": {
      "zh": "本例焦点位置相同，为什么仍可能出现雾感或眩光？",
      "en": "Why can this example show haze or glare even with the same focal position?"
    },
    "options": [
      {
        "id": "transmission-scattering",
        "label": {
          "zh": "晶状体混浊改变透光与散射",
          "en": "Lens clouding changes light transmission and scattering"
        },
        "feedback": {
          "zh": "固定焦点只能排除本例焦点变化，不能消除混浊对视觉质量的影响。",
          "en": "A fixed focus excludes a focal change in this example; it does not remove the effects of clouding on image quality."
        }
      },
      {
        "id": "only-defocus",
        "label": {
          "zh": "所有视物不清都只因为焦点偏移",
          "en": "All unclear vision comes only from a shifted focus"
        },
        "feedback": {
          "zh": "散射与离焦是不同机制。本章保持屈光参数不变，仍可单独说明混浊影响。",
          "en": "Scattering and defocus are different mechanisms. This chapter illustrates clouding while holding refraction fixed."
        }
      },
      {
        "id": "pupil-tissue",
        "label": {
          "zh": "瞳孔变成一块白色组织",
          "en": "The pupil becomes a solid white structure"
        },
        "feedback": {
          "zh": "瞳孔仍是开口；本例变化在其后方晶状体，不能把开口当成病变实体。",
          "en": "The pupil remains an opening. The change is in the lens behind it, not in a solid structure replacing the opening."
        }
      }
    ],
    "correctOptionId": "transmission-scattering",
    "sources": [
      "M02"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "cat-distinction-03",
    "context": "cataract",
    "kind": "concept",
    "target": "lens",
    "prompt": {
      "zh": "普通外部矫正镜片等价于清除晶状体混浊吗？",
      "en": "Is an ordinary corrective lens equivalent to removing clouding from the crystalline lens?"
    },
    "options": [
      {
        "id": "different-mechanism",
        "label": {
          "zh": "不等价：改变屈光关系不等于清除混浊",
          "en": "No: changing refraction does not remove clouding"
        },
        "feedback": {
          "zh": "矫正镜片可改变聚焦关系，但本例混浊不会因此消失；这不用于判断个体治疗。",
          "en": "A corrective lens can change focusing, but does not remove the clouding shown here. This does not determine individual treatment."
        }
      },
      {
        "id": "lens-clears-clouding",
        "label": {
          "zh": "等价：焦点回到视网膜，混浊就自动消失",
          "en": "Yes: restoring retinal focus automatically clears the lens"
        },
        "feedback": {
          "zh": "聚焦位置与晶状体透明度不同，不能将光学矫正直接表示为清除混浊。",
          "en": "Focus location and lens transparency are separate; optical correction cannot be represented as removal of clouding."
        }
      },
      {
        "id": "no-refractive-change",
        "label": {
          "zh": "不等价，因为白内障从不会伴随屈光变化",
          "en": "No, because cataracts never involve refractive changes"
        },
        "feedback": {
          "zh": "本章固定屈光参数只是为了讲清散射，不能推广成现实白内障从不影响屈光。",
          "en": "Fixed refraction isolates scattering in this chapter; it does not mean real cataracts never affect refraction."
        }
      }
    ],
    "correctOptionId": "different-mechanism",
    "sources": [
      "M02"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "gla-route-01",
    "context": "glaucoma",
    "kind": "concept",
    "target": "trabecular-meshwork",
    "prompt": {
      "zh": "房水经小梁网流出，主要经过哪些结构？",
      "en": "Which structures form the main trabecular outflow pathway?"
    },
    "options": [
      {
        "id": "aqueous-route",
        "label": {
          "zh": "后房 → 瞳孔 → 前房 → 小梁网 → Schlemm 管 → 集液管与巩膜表层静脉",
          "en": "Posterior chamber → pupil → anterior chamber → trabecular meshwork → Schlemm’s canal → collector channels and episcleral veins"
        },
        "feedback": {
          "zh": "房水由睫状突产生，经这条主要途径回流至静脉系统；另有葡萄膜巩膜途径。三维箭头仅画到小梁网，不表示完整流出通道在此结束。",
          "en": "Aqueous humor is produced by the ciliary processes and returns to the venous system through this main pathway; a uveoscleral pathway also exists. The 3D arrows stop at the meshwork, but the drainage pathway continues beyond it."
        }
      },
      {
        "id": "vitreous-route",
        "label": {
          "zh": "玻璃体腔 → 视网膜 → 视神经",
          "en": "Vitreous chamber → retina → optic nerve"
        },
        "feedback": {
          "zh": "后房是虹膜后的狭窄空间，不是玻璃体腔；视神经传递神经信息，不是房水出口。",
          "en": "The posterior chamber is the narrow space behind the iris, not the vitreous chamber. The optic nerve carries neural information, not aqueous outflow."
        }
      },
      {
        "id": "reverse-route",
        "label": {
          "zh": "前房 → 瞳孔 → 后房 → 晶状体内部",
          "en": "Anterior chamber → pupil → posterior chamber → inside the lens"
        },
        "feedback": {
          "zh": "本例路线从后房经瞳孔向前房，不流入晶状体内部。",
          "en": "The illustrated route goes from the posterior chamber through the pupil to the anterior chamber, not into the lens."
        }
      }
    ],
    "correctOptionId": "aqueous-route",
    "sources": [
      "M04",
      "M11"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "gla-pressure-02",
    "context": "glaucoma",
    "kind": "concept",
    "target": "optic-nerve",
    "prompt": {
      "zh": "怎样理解眼压升高与青光眼的关系？",
      "en": "How should elevated pressure be related to glaucoma?"
    },
    "options": [
      {
        "id": "risk-not-diagnosis",
        "label": {
          "zh": "眼压升高增加风险，但单凭它不能确定已有青光眼损害",
          "en": "Elevated pressure increases risk but alone does not establish glaucoma damage"
        },
        "feedback": {
          "zh": "眼压是可干预的风险因素；判断青光眼还需评估视神经、神经纤维层和视野等。风险情景不代表已确诊损害。",
          "en": "Eye pressure is a modifiable risk factor. Evaluation for glaucoma also considers the optic nerve, nerve-fiber layer and visual field. The risk scenario does not represent diagnosed damage."
        }
      },
      {
        "id": "pressure-is-disease",
        "label": {
          "zh": "只要眼压升高，就已经有青光眼损害",
          "en": "Any elevated pressure means glaucoma damage is already present"
        },
        "feedback": {
          "zh": "并非所有高眼压者都有青光眼，不能从一个风险因素直接推出损害。",
          "en": "Not everyone with elevated pressure has glaucoma; one risk factor cannot directly establish damage."
        }
      },
      {
        "id": "no-pressure-relation",
        "label": {
          "zh": "眼压与青光眼完全无关",
          "en": "Eye pressure has no relation to glaucoma"
        },
        "feedback": {
          "zh": "眼压是重要风险因素，降低眼压可帮助保护视功能；但它并非单独诊断标准。",
          "en": "Pressure is an important risk factor, and lowering it can help protect vision, but it is not a diagnosis on its own."
        }
      }
    ],
    "correctOptionId": "risk-not-diagnosis",
    "sources": [
      "M17",
      "M03",
      "M04"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "gla-normal-tension-03",
    "context": "glaucoma",
    "kind": "concept",
    "target": "optic-nerve",
    "prompt": {
      "zh": "眼压在正常范围内，能单独排除青光眼吗？",
      "en": "Can pressure in the normal range alone rule out glaucoma?"
    },
    "options": [
      {
        "id": "cannot-rule-out",
        "label": {
          "zh": "不能，正常眼压情景也可能存在视神经损害",
          "en": "No; optic nerve damage can occur with normal-range pressure"
        },
        "feedback": {
          "zh": "本例独立展示正常眼压下的损害，说明压力并非唯一判断依据。",
          "en": "This independent example shows damage with normal-range pressure, illustrating why pressure is not the only consideration."
        }
      },
      {
        "id": "always-no-disease",
        "label": {
          "zh": "能，正常眼压保证没有青光眼",
          "en": "Yes; normal pressure guarantees no glaucoma"
        },
        "feedback": {
          "zh": "有些青光眼患者眼压处在通常的正常范围，不能只看压力排除。",
          "en": "Some people with glaucoma have pressure within the usual normal range, so pressure alone cannot exclude it."
        }
      },
      {
        "id": "always-symptoms",
        "label": {
          "zh": "只要自己感觉视野正常，就能排除",
          "en": "A subjectively normal field is enough to exclude it"
        },
        "feedback": {
          "zh": "早期开角型青光眼可已有本人未察觉的视野损害，主观感觉正常不能单独排除。",
          "en": "Early open-angle glaucoma can involve field loss that a person has not noticed; a normal subjective experience alone cannot rule it out."
        }
      }
    ],
    "correctOptionId": "cannot-rule-out",
    "sources": [
      "M03",
      "M04"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "gla-irreversible-04",
    "context": "glaucoma",
    "kind": "concept",
    "target": "optic-nerve",
    "prompt": {
      "zh": "在已有损害案例中改善流出，应怎样理解？",
      "en": "What does improved outflow mean in the example with existing damage?"
    },
    "options": [
      {
        "id": "damage-retained",
        "label": {
          "zh": "降低眼压有助于减缓进展，不能逆转既有的青光眼性视功能丧失",
          "en": "Lowering pressure helps slow progression but cannot reverse established glaucomatous vision loss"
        },
        "feedback": {
          "zh": "本例改善流出后保留神经及视野损害；软件重置只是重新演示。",
          "en": "The example retains nerve and field damage after outflow improves; a software reset merely restarts the illustration."
        }
      },
      {
        "id": "nerve-regenerated",
        "label": {
          "zh": "视神经立刻再生，视野必然全部恢复",
          "en": "The nerve regenerates immediately and the entire field returns"
        },
        "feedback": {
          "zh": "降低眼压有助于保护剩余视功能，不能使丢失的神经纤维再生或恢复已丧失的视野。",
          "en": "Lowering pressure helps protect remaining vision; it does not regenerate lost nerve fibers or restore established field loss."
        }
      },
      {
        "id": "reset-is-treatment",
        "label": {
          "zh": "点击重置就表示真实治疗成功",
          "en": "Resetting the scene represents successful treatment"
        },
        "feedback": {
          "zh": "重置仅恢复软件默认参数，不能解释成真实损害消失或个体治疗结果。",
          "en": "Reset restores software defaults, not disappearance of real damage or an individual treatment outcome."
        }
      }
    ],
    "correctOptionId": "damage-retained",
    "sources": [
      "M03",
      "M04"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "str-alignment-01",
    "context": "strabismus",
    "kind": "concept",
    "target": null,
    "prompt": {
      "zh": "本例怎样区分内斜与外斜？",
      "en": "How does this example distinguish esotropia from exotropia?"
    },
    "options": [
      {
        "id": "nasal-temporal",
        "label": {
          "zh": "偏斜眼相对正常注视方向：向鼻侧为内斜，向颞侧为外斜",
          "en": "From normal gaze: nasal deviation is esotropia; temporal deviation is exotropia"
        },
        "feedback": {
          "zh": "依据患者鼻颞方位；切换眼侧和镜头不改变这个含义。",
          "en": "Use the patient’s nasal and temporal directions; changing the eye or camera does not change their meaning."
        }
      },
      {
        "id": "screen-direction",
        "label": {
          "zh": "向屏幕左侧总是内斜，向右侧总是外斜",
          "en": "Screen-left always means esotropia and screen-right exotropia"
        },
        "feedback": {
          "zh": "屏幕左右随镜头和眼侧变化，不是内斜、外斜的定义。",
          "en": "Screen left and right change with the camera and eye side; they do not define esotropia and exotropia."
        }
      },
      {
        "id": "muscle-weakness",
        "label": {
          "zh": "内斜一定是所有眼外肌都无力",
          "en": "Esotropia always means every eye muscle is weak"
        },
        "feedback": {
          "zh": "斜视涉及眼位与运动协调，不能把方向分类直接归为全部肌肉无力。",
          "en": "Strabismus involves alignment and movement coordination; a directional category does not establish generalized muscle weakness."
        }
      }
    ],
    "correctOptionId": "nasal-temporal",
    "sources": [
      "M06"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "str-convergence-02",
    "context": "strabismus",
    "kind": "concept",
    "target": null,
    "prompt": {
      "zh": "正常看近时，两条注视方向线不平行，是否就代表斜视？",
      "en": "Do nonparallel gaze lines during normal near viewing necessarily mean strabismus?"
    },
    "options": [
      {
        "id": "normal-convergence",
        "label": {
          "zh": "不代表；两眼仍可会聚并共同对准目标",
          "en": "No; both eyes can converge while remaining aligned to the target"
        },
        "feedback": {
          "zh": "关键是两眼相对同一目标是否协调对准，而不是方向线永远平行。",
          "en": "What matters is coordinated alignment to the same target, not lines that remain parallel at every distance."
        }
      },
      {
        "id": "all-convergence-esotropia",
        "label": {
          "zh": "代表，所有会聚都是内斜视",
          "en": "Yes; all convergence is esotropia"
        },
        "feedback": {
          "zh": "正常会聚适应近距离目标；这与一眼在正常注视方向外额外偏斜不同。",
          "en": "Normal convergence supports near viewing; it differs from an additional deviation away from normal gaze."
        }
      },
      {
        "id": "only-one-eye-near",
        "label": {
          "zh": "看近时本来就只能一眼对准",
          "en": "Only one eye can normally align to a near target"
        },
        "feedback": {
          "zh": "本例正常状态下，两眼会分别转向同一个近目标，并非只能一眼参与。",
          "en": "In the normal reference, both eyes turn toward the same near target; participation is not limited to one eye."
        }
      }
    ],
    "correctOptionId": "normal-convergence",
    "sources": [
      "M06",
      "M14"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "str-amblyopia-03",
    "context": "strabismus",
    "kind": "concept",
    "target": null,
    "prompt": {
      "zh": "斜视与弱视是什么关系？",
      "en": "How are strabismus and amblyopia related?"
    },
    "options": [
      {
        "id": "related-not-identical",
        "label": {
          "zh": "眼位不一致与视觉发育问题不同，可相关但不等同",
          "en": "Misalignment and a visual-development problem differ; they may be related but are not identical"
        },
        "feedback": {
          "zh": "斜视可能影响儿童视觉发育，但并非每个斜视者都有弱视，眼位整齐也不能单独排除弱视。",
          "en": "Strabismus may affect childhood visual development, but not everyone with strabismus has amblyopia, and aligned eyes alone do not rule it out."
        }
      },
      {
        "id": "synonyms",
        "label": {
          "zh": "两者只是同一疾病的不同名称",
          "en": "They are two names for the same condition"
        },
        "feedback": {
          "zh": "两者描述不同层面：斜视是眼位，弱视涉及视觉发育与视功能。",
          "en": "They describe different aspects: strabismus concerns alignment; amblyopia concerns visual development and function."
        }
      },
      {
        "id": "inevitable-amblyopia",
        "label": {
          "zh": "每个斜视者必然同时有弱视",
          "en": "Everyone with strabismus necessarily has amblyopia"
        },
        "feedback": {
          "zh": "二者可以关联，也可以分别存在，不能把可能的联系写成必然。",
          "en": "They may occur together or separately; a possible relationship is not inevitable."
        }
      }
    ],
    "correctOptionId": "related-not-identical",
    "sources": [
      "M05",
      "M06",
      "M12"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "amb-cause-01",
    "context": "amblyopia",
    "kind": "concept",
    "target": null,
    "prompt": {
      "zh": "哪些输入问题可能与儿童期弱视形成有关？",
      "en": "Which input problems can contribute to amblyopia during childhood?"
    },
    "options": [
      {
        "id": "multiple-input-causes",
        "label": {
          "zh": "屈光参差、斜视或形觉剥夺等异常视觉经验",
          "en": "Abnormal visual experience such as anisometropia, strabismus or form deprivation"
        },
        "feedback": {
          "zh": "这些因素可干扰视觉发育；双眼高度未矫正屈光不正也可致双眼弱视。风险因素本身不能确诊，弱视需结合最佳矫正视力与眼部检查评估。",
          "en": "These factors can disrupt visual development; high uncorrected refractive error in both eyes can also cause bilateral amblyopia. Risk factors alone do not establish the diagnosis, which requires assessment of best-corrected acuity and the eyes."
        }
      },
      {
        "id": "only-lazy-muscle",
        "label": {
          "zh": "只能是某条眼外肌不够努力",
          "en": "Only an eye muscle failing to make enough effort"
        },
        "feedback": {
          "zh": "弱视不是肌肉懒惰或患者不努力。它与儿童期视觉发育受影响有关。",
          "en": "Amblyopia is not a lazy muscle or lack of effort; it involves affected visual development during childhood."
        }
      },
      {
        "id": "only-cloudy-lens",
        "label": {
          "zh": "所有弱视都必须有晶状体混浊",
          "en": "Every case must involve lens clouding"
        },
        "feedback": {
          "zh": "晶状体混浊只是可能的输入受限原因之一；屈光参差与斜视示例可以没有混浊。",
          "en": "Lens clouding is only one possible source of restricted input; refractive and strabismic examples can have clear lenses."
        }
      }
    ],
    "correctOptionId": "multiple-input-causes",
    "sources": [
      "M16",
      "M05",
      "M12"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "amb-appearance-02",
    "context": "amblyopia",
    "kind": "concept",
    "target": null,
    "prompt": {
      "zh": "双眼看起来整齐，能单独排除弱视吗？",
      "en": "Can visibly aligned eyes alone rule out amblyopia?"
    },
    "options": [
      {
        "id": "appearance-insufficient",
        "label": {
          "zh": "不能，输入质量与视觉发育问题可能没有明显眼位变化",
          "en": "No; input quality and visual-development problems may occur without obvious misalignment"
        },
        "feedback": {
          "zh": "屈光参差示例双眼对准，仍可有不同输入；外观不是视功能检查。",
          "en": "The anisometropia example has aligned eyes but different input; appearance is not a visual-function assessment."
        }
      },
      {
        "id": "straight-means-normal",
        "label": {
          "zh": "能，整齐外观保证视觉发育正常",
          "en": "Yes; straight-looking eyes guarantee normal visual development"
        },
        "feedback": {
          "zh": "眼位与视功能不同，弱视可能发生在外观正常的眼睛。",
          "en": "Alignment and visual function differ; amblyopia can occur in eyes that look normal."
        }
      },
      {
        "id": "cloudiness-required",
        "label": {
          "zh": "只有看得见混浊才可能有弱视",
          "en": "Amblyopia is possible only with visible clouding"
        },
        "feedback": {
          "zh": "混浊不是所有弱视的必要条件；输入异常还有其他原因。",
          "en": "Clouding is not required in every case; abnormal input has other possible causes."
        }
      }
    ],
    "correctOptionId": "appearance-insufficient",
    "sources": [
      "M16",
      "M05",
      "M12"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "amb-input-03",
    "context": "amblyopia",
    "kind": "concept",
    "target": null,
    "prompt": {
      "zh": "改善成像、眼位或解除遮挡后，能否认定弱视已恢复？",
      "en": "Does a clearer retinal image, realignment or removal of an obstruction establish recovery from amblyopia?"
    },
    "options": [
      {
        "id": "input-outcome-distinct",
        "label": {
          "zh": "不能仅据此认定；视力可以改善，但恢复情况需要随访评估",
          "en": "Not on that basis alone; acuity can improve, but recovery needs reassessment"
        },
        "feedback": {
          "zh": "弱视并不等于永久不可改善。适当屈光矫正本身可使部分患儿视力逐步提高，是否需其他治疗取决于评估；模型不模拟个体疗效或恢复时间。",
          "en": "Amblyopia is not necessarily permanently unchangeable. Appropriate optical correction alone can gradually improve acuity in some children; assessment determines whether further treatment is needed. The model does not predict individual outcomes or recovery time."
        }
      },
      {
        "id": "immediate-cure",
        "label": {
          "zh": "只要图像清晰，弱视就一定即时消失",
          "en": "A clear input image guarantees immediate resolution of amblyopia"
        },
        "feedback": {
          "zh": "光学输入与发育结果不能合成同一个开关；不能由模型保证即时恢复。",
          "en": "Optical input and developmental outcome cannot be combined into one switch; the model cannot guarantee immediate recovery."
        }
      },
      {
        "id": "input-never-matters",
        "label": {
          "zh": "不能，因为改善输入永远不可能帮助弱视改善",
          "en": "No, because better input can never help amblyopia improve"
        },
        "feedback": {
          "zh": "改善视觉输入是弱视干预的重要基础，不能将尚未证明恢复误解为无法改善。恢复需结合后续视力变化评估。",
          "en": "Improving visual input is an important foundation of amblyopia treatment. Recovery not yet established does not mean improvement is impossible; follow-up acuity measurements help assess the response."
        }
      }
    ],
    "correctOptionId": "input-outcome-distinct",
    "sources": [
      "M16",
      "M05",
      "M12"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
  {
    "id": "amb-distinction-04",
    "context": "amblyopia",
    "kind": "concept",
    "target": null,
    "prompt": {
      "zh": "怎样向患者解释弱视与斜视的区别？",
      "en": "How can amblyopia be distinguished from strabismus?"
    },
    "options": [
      {
        "id": "function-versus-alignment",
        "label": {
          "zh": "弱视涉及发育期形成的最佳矫正视力降低；斜视描述眼位不一致",
          "en": "Amblyopia involves reduced best-corrected acuity arising during development; strabismus describes misalignment"
        },
        "feedback": {
          "zh": "两者可能关联，也可分别存在。不能用眼位外观代替对视觉功能的了解。",
          "en": "They may be related or occur separately. Eye alignment cannot substitute for understanding visual function."
        }
      },
      {
        "id": "both-muscle-laziness",
        "label": {
          "zh": "两者都只是眼外肌懒惰",
          "en": "Both simply mean lazy eye muscles"
        },
        "feedback": {
          "zh": "这种说法混淆眼位协调和视觉发育，也会误解患者对症状的控制能力。",
          "en": "This confuses alignment control with visual development and misrepresents how much control the person has over the condition."
        }
      },
      {
        "id": "alignment-fixes-all",
        "label": {
          "zh": "只要把眼位回正，两者的所有问题都立刻消失",
          "en": "Straightening the eyes immediately removes every problem from both conditions"
        },
        "feedback": {
          "zh": "眼位回正的几何示意不保证已形成的视觉发育问题即时恢复。",
          "en": "A geometric illustration of realignment does not guarantee immediate recovery of an established developmental problem."
        }
      }
    ],
    "correctOptionId": "function-versus-alignment",
    "sources": [
      "M16",
      "M05",
      "M06",
      "M12"
    ],
    "reviewStatus": "llm-checked",
    "contentVersion": "2026-10-22-diseases",
    "translationStatus": "llm-checked",
    "medicalReviewStatus": "pending"
  },
];
export const questionById = (id: string) => QUESTIONS.find(question => question.id === id);
export const questionsFor = (context: QuestionContext) => QUESTIONS.filter(question => question.context === context);
