# bamboo-cicada

[![npm](https://img.shields.io/npm/v/bamboo-cicada)](https://www.npmjs.com/package/bamboo-cicada)
[![license: MIT](https://img.shields.io/badge/license-MIT-2f5847)](LICENSE)

[在线试玩](https://bkmashiro.github.io/bamboo-cicada/) · [npm 包](https://www.npmjs.com/package/bamboo-cicada)

一个可以外挂到任意网页上的悬浮竹知了。默认直接可玩，同时允许替换知了 DOM、杆子 DOM、声音实现、渲染器与物理参数。

- 运行时零依赖
- Web Component + Shadow DOM
- 组件画面聚焦杆、绳和知了，宿主页面保持原有布局
- 指针驱动的绳系质点物理
- Web Audio 合成声音；转速影响音高、音色和音量
- 素材与逻辑随包本地运行

> 代码、声音与视觉均为独立原创实现；参考项目 `imsai-sh/zhuzhiliao` 用于概念与架构研究。

## 最快使用

```ts
import { mountBambooCicada } from 'bamboo-cicada';

mountBambooCicada(); // 默认挂载到 document.body，固定悬浮在右下角
```

旧的 host-first 调用仍然可用：

```ts
mountBambooCicada(document.querySelector('#some-host')!);
```

也可以声明式使用：

```html
<script type="module">
  import 'bamboo-cicada';
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
toy.setAnchor(170, 120); // 340 × 430 逻辑坐标
console.log(toy.motion);
```

## 是否会变音？

会。默认 `SynthCicadaVoice` 使用绳方向角速度、绳长比、转动相位和活动强度共同驱动声音：

- 转得越快：基础频率越高；
- 转得越快：带通中心频率越高，声音更亮；
- 每圈相位：产生轻微 detune 摆动；
- 绳松弛：音量门控为零；
- 张紧且快速旋转：音量逐渐升高。

映射函数 `mapVoiceParameters(state)` 是公开的，开发者可以复用同一运动状态连接自己的采样器或音频引擎。

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

```ts
import type { CicadaVoice, MotionState } from 'bamboo-cicada';

class SampleVoice implements CicadaVoice {
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
import type { CicadaRenderer } from 'bamboo-cicada';

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
