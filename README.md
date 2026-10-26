# eyesight

供医生进行眼球结构科普、常见眼病科普与互动演示的纯前端应用。医生可自由选择结构或疾病主题，指认位置、比较正常与变化；短导览与理解确认按需使用。

![eyesight 交互预览](preview.png)

[在线演示](https://tipsypotato.github.io/eyesight/) · [功能说明与待办](docs/development-status-2026-10-22.md) · [维护约定](AGENTS.md) · [第三方许可](THIRD_PARTY_NOTICES.md)

## 当前功能

| 工作区 | 主要能力 |
| --- | --- |
| 解剖探索 | 成人右眼 51 个组织/区域/空间；眼外肌、结膜、眼睑、眼眶与内容物，头骨位置参照；搜索、图层、隔离、关联观察、十种预设、三轴剖切与分层/平铺 |
| 基础光路 | 正常聚焦、轴性近视、镜片矫正；五类参数、二维/三维同源光路、同条件对照；瞳孔、调节及神经信号演示 |
| 短导览 | 三条导览、11 步及 11 项可选观察操作，可随时返回探索 |
| 理解确认 | 共 29 道结构、导览及眼病题，独立会话、解释与错题回顾 |
| 常见眼病 | 白内障、青光眼、斜视、弱视；正常/变化切换、机制说明与可选题目 |

每次打开页面均展示全部结构与头骨；中英文、导览、题目及疾病记录保存在当前浏览器。手机默认单指滚页，进入“操作模型”后旋转、缩放与拖动剖切框。初始画面优先展示低精头骨并完成整体取景，精细头骨和虹膜随后补齐；头骨预览最多额外等待 3 秒，失败或超时后仍可操作眼球。

视网膜微观层级、场景链接/PNG 导出/展示模式、结构图鉴和眼部外形资产仍为可选待办。动态肌肉、眨眼、完整泪器和精细眶部网络尚未实现；具体边界及待验证项见[功能清单](docs/development-status-2026-10-22.md#待实现及待验证清单)。

## 本地运行

需要 Node.js 22.12+（22.x）、24.x 或 26+，以及 npm；已验证环境为 Node.js 26.5.0、npm 11.17.0。

本机项目目录为 `/Users/lifeng/Code/github/eyesight`：

```sh
cd /Users/lifeng/Code/github/eyesight
npm ci
npm run dev
```

开发服务仅绑定本机，默认地址为 `http://127.0.0.1:5173`；以终端输出为准。

```sh
npm test -- --maxWorkers=1
npm run typecheck
npm run build
npm run preview
```

生产文件输出到 `dist/`，须通过 HTTP 服务访问，不能直接双击 `index.html`。生产预览默认地址为 `http://127.0.0.1:4173`。

若头骨不可用且模块请求返回 `504 Outdated Optimize Dep`，停止开发服务，运行 `npm run dev -- --force` 后刷新。临时 Vite 检查必须使用独立缓存，见 [AGENTS.md](AGENTS.md)；无需清空浏览器记录。

## 在线演示与发布

推送到 `main` 后，[GitHub Actions](https://github.com/tipsypotato/eyesight/actions/workflows/pages.yml) 使用 Node.js 26 安装锁定依赖，执行测试、类型检查与构建，然后发布 `dist/`；检查失败不会更新站点。也可在 Actions 选择 `main` 手动运行。仓库 Settings → Pages 的 Source 使用 **GitHub Actions**，部署配置参考 [GitHub Pages 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

应用使用相对资源路径兼容 `/eyesight/`。线上与本地浏览器记录各自独立。线上版本以 Actions 成功部署的提交为准；回滚时将对应 `git revert` 提交到 `main` 并推送，经检查后重新发布。

## 验证与技术

2026-10-26 冷启动修复已验证：35 个测试文件、658 项通过，TypeScript 与生产构建通过；本机 Chrome 确认头骨首帧完整显示、精细升级、超时与失败降级正常。模拟 1.6 Mbps、150 ms 延迟，三次冷启动中位数由 4.23 秒降至 3.38 秒；测量方法、线上网络瓶颈和 390px 检查范围见[验证范围](docs/development-status-2026-10-22.md#验证范围)。修复尚未部署，真实手机、低端 GPU 和完整跨浏览器验收仍待验证。

使用 React、TypeScript、Three.js、Zustand 和 Vite，无账户、后端或运行时翻译服务。眼部为程序几何；头骨为本地 CC0 GLB。修改虹膜像素算法后，使用 Node.js 26 执行 `node scripts/bake-iris-textures.mjs` 更新预生成资源。加载方式、资产体积和性能限制见功能清单的“启动与渐进加载”。

| 目录 | 职责 |
| --- | --- |
| `src/anatomy/`、`src/content/` | 结构、关系、双语说明与题库 |
| `src/engine/` | 几何、渲染、相机、剖切、光学与眼病效果 |
| `src/state/`、`src/modes/` | 场景草稿、本地恢复、题目会话与演示状态 |
| `src/ui/`、`src/styles/` | 响应式工作区与操作面板 |
| `public/`、`scripts/` | 静态资产与虹膜资源生成脚本 |
| `docs/` | 功能说明、待实现及待验证清单 |

这是科普示意，几何、光学及疾病效果未经临床标定，不输出诊断、处方或疗效预测。中英文经独立 LLM 对照审校，医学内容仍待专家审核。记录只存在当前浏览器，清除存储后没有服务端备份。

作者：tipsypotato。代码采用 [MIT](LICENSE)；第三方许可与来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。后续每轮功能迭代同步更新功能清单并提交本地 Git；推送与部署按用户明确要求执行。
