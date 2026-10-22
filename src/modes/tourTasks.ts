import type { Localized, StructureId } from '../anatomy/types';

export type TourAction = { kind: 'select' | 'focus'; id: StructureId } | { kind: 'pause' | 'sync' | 'observed' | 'signal-start' | 'signal-retina' | 'signal-nerve' | 'normal' | 'comparison' | 'axial' | 'lens' };
export type TaskProgress = { status: 'visited' | 'done'; actions: string[]; hint: boolean };
export const TOUR_TASKS: Record<string, { text: Localized; actions: string[] }> = {
  'anatomy:0': { text: { zh: '点选巩膜，观察它与前部角膜的连接。', en: 'Select the sclera and observe where it joins the cornea at the front.' }, actions: ['select:sclera'] },
  'anatomy:1': { text: { zh: '从外到内依次点选：巩膜 → 脉络膜 → 视网膜。', en: 'Select from outside inward: sclera → choroid → retina.' }, actions: ['select:sclera', 'select:choroid', 'select:retina'] },
  'anatomy:2': { text: { zh: '依次定位前房、后房和玻璃体区域；前两者含房水，后者含凝胶。', en: 'Focus on the anterior chamber, posterior chamber, then vitreous region. The first two contain aqueous humor; the last contains gel.' }, actions: ['focus:anterior-chamber', 'focus:posterior-chamber', 'focus:vitreous'] },
  'anatomy:3': { text: { zh: '对照黄斑与视盘，定位中央凹，然后确认已观察鼻颞关系。', en: 'Compare the macula and optic disc, focus on the fovea, then confirm you have observed their nasal–temporal relationship.' }, actions: ['focus:fovea', 'observed'] },
  'vision:0': { text: { zh: '暂停入射光示意，再定位虹膜中央的瞳孔开口。', en: 'Pause the incoming-light demonstration, then focus on the pupil opening in the center of the iris.' }, actions: ['pause', 'focus:pupil'] },
  'vision:1': { text: { zh: '打开同步光路图，再定位晶状体；角膜与晶状体共同参与聚焦。', en: 'Open the synchronized ray diagram, then focus on the lens. Both the cornea and lens contribute to focusing.' }, actions: ['sync', 'focus:lens'] },
  'vision:2': { text: { zh: '观察正常基准中焦点与视网膜的位置，再点击“已观察”。', en: 'Observe the focus relative to the retina in the normal baseline, then choose “Observed”.' }, actions: ['observed'] },
  'vision:3': { text: { zh: '从首步开始，手动单步完成入光 → 视网膜转换 → 神经传出。', en: 'Start at the first state and manually step through incoming light → retinal conversion → neural output.' }, actions: ['signal-start', 'signal-retina', 'signal-nerve'] },
  'myopia:0': { text: { zh: '选择正常聚焦，再保存为对照。', en: 'Choose normal focus, then save it as the reference.' }, actions: ['normal', 'comparison'] },
  'myopia:1': { text: { zh: '将眼轴示意增量从 0 调至至少 0.8，观察视网膜后移；此值只是操作检测条件，不是临床阈值。', en: 'Increase the illustrative axial increment from 0 to at least 0.8 and observe the retina move back. This value checks the action; it is not a clinical threshold.' }, actions: ['axial'] },
  'myopia:2': { text: { zh: '开启本例发散镜片，观察焦点回到示例视网膜；可关闭后重复比较。', en: 'Enable the example diverging lens and observe the focus return to the model retina. Switch it off to compare again.' }, actions: ['lens'] },
};

export function advanceTask(key: string, previous: TaskProgress | undefined, event: TourAction): TaskProgress | undefined {
  const task = TOUR_TASKS[key];
  if (!task || previous?.status === 'done') return previous;
  const token = 'id' in event ? `${event.kind}:${event.id}` : event.kind;
  const actions = previous?.actions ?? [];
  if (token === task.actions[actions.length]) {
    const next = [...actions, token];
    return { status: next.length === task.actions.length ? 'done' : 'visited', actions: next, hint: false };
  }
  if (event.kind === 'select' && key === 'anatomy:1') return { status: 'visited', actions: token === task.actions[0] ? [token] : [], hint: true };
  return previous ?? { status: 'visited', actions: [], hint: false };
}
