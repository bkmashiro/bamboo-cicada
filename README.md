# zhuzhiliao

[![npm](https://img.shields.io/npm/v/zhuzhiliao)](https://www.npmjs.com/package/zhuzhiliao)
[![license: MIT](https://img.shields.io/badge/license-MIT-2f5847)](LICENSE)

[在线试玩](https://bkmashiro.github.io/bamboo-cicada/) · [互动科学报告](https://bkmashiro.github.io/bamboo-cicada/science.html) · [npm 包](https://www.npmjs.com/package/zhuzhiliao)

一个可以外挂到任意网页上的悬浮竹知了。默认直接可玩，同时允许替换知了 DOM、杆子 DOM、声音实现、渲染器与物理参数。

- 运行时零依赖
- Web Component + Shadow DOM
- 组件画面聚焦杆、绳和知了，宿主页面保持原有布局
- 指针驱动的绳系质点物理
- Web Audio 程序化合成声音；转速、张力、旋转方向和材料参数共同改变音色
- 素材与逻辑随包本地运行

> 代码、声音与视觉均为独立原创实现；参考项目 `imsai-sh/zhuzhiliao` 用于概念与架构研究。

## 最快使用

```bash
pnpm add zhuzhiliao
```

```ts
import { mountBambooCicada } from 'zhuzhiliao';

mountBambooCicada(); // 默认挂载到 document.body，透明坐标层覆盖整个视口
```

host-first 调用兼容现有项目：

```ts
mountBambooCicada(document.querySelector('#some-host')!);
```

也可以声明式使用：

```html
<script type="module">
  import 'zhuzhiliao';
</script>

<bamboo-cicada></bamboo-cicada>
```

## 交互

抓住杆子或知了本体，按住后画圈。输入移动杆端锚点，知了作为独立质点受到：

- 重力；
- 空气阻力；
- 拉伸阶段生效的弹性绳张力；
- 绳方向径向阻尼。

每帧内部以固定小步长积分，页面掉帧时也会限制最大能量注入。松手后，知了继续靠惯性摆动并逐渐停下。默认手势位移有 `1.45×` 增益，方便触屏用较小的拇指圈甩响；可用 `inputGain` 调整或设为 `1`。

```ts
const toy = mountBambooCicada({ inputGain: 1.2 });
toy.startAuto();
toy.stopAuto();
toy.setAnchor(520, 180); // 当前视口内的 CSS 像素坐标
console.log(toy.motion);
```

## 是否会变音？

会。默认 `SynthCicadaVoice` 使用绳方向角速度、绳长比、转动相位和活动强度共同驱动一套 reduced-order physical model（降阶物理模型）：

- 在拟合状态 `2.367 r/s` 下，每秒约产生 `78` 个主要 stick-slip 事件，即每圈约 `33` 次；
- 脉冲间隔使用 `CV ≈ 0.25` 的确定性不规则 renewal process，避免机械式等周期振荡；
- 两个膜/膜—空气有效模态为 `1506.37 Hz / Q 10.49` 与 `1760.85 Hz / Q 10.62`；
- 小膜辐射先经过 `1863.85 Hz` 高通，压住不合理的 `300–800 Hz` 低频机械位移能量；
- 一条 `108.86 mm` 的有损竹筒支路以 `0.40` 反射、`1.50` 损耗和 `0.45` 反相耦合叠回直达声，产生短 group delay 与空心脉冲尾；
- 每圈叠加深度约 `0.66` 的一次 AM 与 `0.35` 的二次 AM；
- 绳松弛时音量门控为零；张紧后，张力与结构参数连续改变模态、管口辐射和输出亮度。

映射函数 `mapVoiceParameters(state)` 与只读拟合参数 `defaultCicadaFit` 均为公开 API，开发者可以复用同一运动状态连接自己的采样器或音频引擎。默认实现只使用程序化激励和 Web Audio 节点。

## 替换知了或杆子的 DOM

### JavaScript

```ts
const cicada = document.createElement('img');
cicada.src = '/my-cicada.webp';
cicada.alt = '我的竹知了';
cicada.style.width = '80px';

const pole = document.createElement('div');
pole.className = 'my-pole';

mountBambooCicada({
  parts: { cicada, pole },
});
```

多实例时建议使用 factory，每只玩具都会获得新节点：

```ts
mountBambooCicada({
  parts: {
    cicada: () => document.querySelector<HTMLTemplateElement>('#my-cicada')!.content.firstElementChild!.cloneNode(true) as HTMLElement,
    pole: () => document.createElement('my-bamboo-pole'),
  },
});
```

### HTML slots

```html
<bamboo-cicada>
  <img slot="cicada" src="/my-cicada.webp" alt="我的竹知了" />
  <div slot="pole" class="my-pole"></div>
</bamboo-cicada>
```

组件变换 slot 外层包装器，你的 DOM 内容和内部样式继续由应用控制。

## 替换音频

默认声音采用轻量 source–filter physical model：

```text
stick-slip pulse + friction noise
              ↓
  membrane modes + radiation HPF
              ↓
 direct + lossy bamboo mouth path
              ↓
     rotation AM + output rolloff
```

`SynthCicadaVoice` 开放 `volume`（默认 `2.5×`，范围 `0.25–4×`）、`friction`、`membraneTension`、`tubeLength` 和 `tubeDiameter`，实时调整最终响度、松香摩擦、膜面张力与竹筒腔体。首次指针或键盘操作会解锁 Web Audio。

```ts
import type { CicadaVoice, MotionState } from 'zhuzhiliao';

class SampleVoice implements CicadaVoice {
  unlock() {
    // 在用户手势中创建或恢复你的 AudioContext
  }
  update(state: Readonly<MotionState>) {
    // 使用 state.rope.angularVelocity / tension / angle 驱动采样器
  }
  silence() {}
  destroy() {}
}

mountBambooCicada({
  voice: () => new SampleVoice(),
});
```

所有权约定：

- 传 factory：实例由组件拥有，`destroy()` 时一并销毁；
- 直接传 voice 对象：视为外部共享资源，组件仅调用 `silence()`。

## 调整物理

```ts
mountBambooCicada({
  physics: {
    ropeLength: 150,
    gravity: 820,
    stiffness: 2500,
    radialDamping: 17,
    airDrag: 0.6,
  },
});
```

完整类型：`PhysicsOptions`、`PhysicsState`、`MotionState`、`RopeState`。

## 替换完整渲染器

```ts
import type { CicadaRenderer } from 'zhuzhiliao';

const renderer: CicadaRenderer = {
  mount({ root, host }) {
    // 可在这里建立 Canvas、SVG、Three.js 或任意 DOM 渲染层
  },
  render(state) {
    // state 是统一的杆端、质点、绳和发声活动状态
  },
  destroy() {},
};

mountBambooCicada({ renderer });
```

`DefaultCicadaRenderer` 提供开箱即用的 DOM 表现。3D 可以作为独立 renderer 包接入，并复用核心物理与音频状态。

Renderer 所有权与 voice 一致：factory 返回的实例由组件销毁，直接传入的对象适合作为外部共享资源。

## 本地试玩

```bash
pnpm install
pnpm dev
```

试玩页是一张普通的本地网页，竹知了通过 `mountBambooCicada()` 额外挂载；网络面板保持零外部素材与后端请求。

## 验证

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm pack
```

## License

MIT
