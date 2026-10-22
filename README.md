# eyesight

基于 [Dental Scope](https://github.com/Yoosseph/dental-scope) 的交互式成人右眼教学 demo。React + TypeScript + Three.js + Zustand + Vite，纯前端运行。

## 运行

需要 Node.js 22.12+（22.x）、24.x 或 26+，以及 npm。本次验证环境：Node.js 26.5.0、npm 11.17.0。

```sh
npm ci
npm run dev
```

打开终端显示的本地地址，默认 http://127.0.0.1:5173 。开发服务只绑定本机。

```sh
npm test
npm run build
npm run preview
```

`dist/` 为已生成的静态网站，可放在静态 HTTP 服务上。不要直接双击 `index.html`：浏览器的模块加载需要 HTTP。

## 已实现

- 成人右眼：17 个可选择的组织、区域和空间，提供中英名称、拉丁名、作用、位置、知识提示与来源。
- 探索：旋转、缩放、四个视角、结构搜索、标签、显示/半透明/隐藏、隔离、分层展开。
- 剖切：矢状、水平、冠状三个切面与位置调节；壁层有截面环。列表选择与聚焦恢复可读的中心矢状面，眼底结构使用半透明外壁显露；直接点击模型保留当前切面。
- 基础光路：正常聚焦、轴性近视、凹透镜矫正。3D 光线和平面图来自同一计算结果，近视时延长后半球，匹配视网膜位置。
- 三条短导览、共 11 步：从外到内、跟随光与神经信号、轴性近视。
- 六题结构识别：命名高亮结构、单次作答、揭晓不计分、反馈与结算。答题前隐藏名称标签和知识卡。
- 中英切换保留当前导览与答题状态，仅语言偏好写入本地存储；不使用运行时翻译 API。
- 窄屏布局、键盘旋转/缩放、减少动画偏好、WebGL 初始化失败提示与上下文恢复重绘。

## 模型细节优化

- 角膜使用连续的非球面薄壳，内外缘分别衔接巩膜，增加平滑的表面高光。
- 虹膜使用确定性生成的颜色与凹凸纹理，表现放射纤维、虹膜卷缩轮附近的不规则纹理和周边收缩沟；瞳孔仍为几何开口。
- 晶状体改为前后不对称的双凸轮廓，加入位于囊膜内的核区，保留透明材质和结构选择。
- 视网膜增加柔和的眼底色泽，黄斑、中央凹及视盘贴附内壁；动静脉采用逐渐变细的分支和绕开中央凹的血管弓。

细节参考：[Webvision 视网膜解剖](https://www.webvision.pitt.edu/book/part-i-foundations/simple-anatomy-of-the-retina/)、[虹膜表面特征研究](https://pmc.ncbi.nlm.nih.gov/articles/PMC4736923/)。几何和纹理均由代码生成，没有新增外部模型、图片或运行依赖。

## 交互

拖动旋转，滚轮或加减按钮缩放。聚焦画布后可用方向键旋转、`+` / `-` 缩放。点击结构列表右侧圆点循环切换显示状态。重置恢复初始场景并保留语言。

测验通过外形和位置识别高亮结构；其他组织保持半透明。选择答案立即提交，不允许修改本题答案。刷新页面会清除本次学习/测验进度，保留语言偏好。

## 内容与模型边界

这是参数化教学示意，非患者扫描或医学级数字孪生。颜色、厚度、部分间距和小结构尺寸经过教学夸张；不涵盖微观层次、完整血管网络、眼外肌、眼睑和泪器。瞳孔作为真实开口，前后房作为空间表示。

透明组织采用透明度与高光近似；封闭眼球内使用简化遮光，展开、剖切或单独查看时恢复可读材质。浅层眼底凹陷并非完整组织学厚度模型。这些视觉优化不构成经过测量标定的折射、散射或临床成像模拟。

光路使用归一化的近轴薄透镜模型，暂不模拟调节、像差或个人验光处方。轴性近视示例保持眼内屈光力不变并延长眼轴，不代表全部近视成因。光线在视网膜处结束；视神经传递的是神经信号。

独立 LLM 已逐条审校中英术语与含义，详见 [翻译审校记录](docs/translation-review.md)。这不等于眼科专家审核，医学内容仍标记为待专家审校。

主要依据：[NEI 眼睛如何工作](https://www.nei.nih.gov/eye-health-information/healthy-vision/how-eyes-work)、[NEI 屈光不正](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/refractive-errors)、[NEI 近视](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/nearsightedness-myopia)。各结构的进一步来源见界面知识卡。

## 代码结构

| 目录 | 职责 |
| --- | --- |
| `src/anatomy/` | 结构数据、导览、共享类型 |
| `src/content/` | 中英界面文案 |
| `src/engine/` | 参数化几何、Three.js 渲染、相机、剖切、光路 |
| `src/state/` | 界面与场景状态、语言偏好 |
| `src/modes/` | 不可变测验逻辑 |
| `src/ui/`、`src/styles/` | 响应式学习工作区 |

代码与新建模型使用 MIT；复用范围和原作者声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。没有复制 Dental Scope 的牙科模型或教育文本。

验证结果和已知限制见 [verification.md](docs/verification.md)。项目使用本地 Git 仓库维护。
