# bamboo-cicada

把一只可以玩的竹知了嵌进任意网页。零运行时依赖，使用 Web Component 隔离样式，用指针转速驱动动画和 Web Audio 合成声音。

> 本项目是独立实现：未复制参考项目 `imsai-sh/zhuzhiliao` 的源码、录音、图像或其他素材。

## 快速使用

### npm

```bash
pnpm add bamboo-cicada
```

```js
import { mountBambooCicada } from 'bamboo-cicada';

const toy = mountBambooCicada(document.querySelector('#toy'), {
  label: '转起来',
  accent: '#d86f45',
});

// 可选控制
toy.startAuto();
toy.stopAuto();
toy.destroy();
```

### 直接使用 Web Component

先加载模块，再在任意位置写标签：

```html
<script type="module">
  import 'bamboo-cicada';
</script>

<bamboo-cicada label="转起来" accent="#d86f45"></bamboo-cicada>
```

元素宽度跟随容器，默认最大宽度为 `22rem`。可以直接通过 CSS 调整：

```css
bamboo-cicada { width: 320px; }
```

## API

### `mountBambooCicada(host, options?)`

返回 `BambooCicadaElement`。可用选项：

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `label` | `string` | `竹知了` | 卡片标题 |
| `accent` | `string` | `#d86f45` | 强调色 |
| `sound` | `boolean` | `true` | 是否启用合成声音 |
| `autoStart` | `boolean` | `false` | 挂载后是否自动旋转 |

实例方法：`configure(options)`、`startAuto()`、`stopAuto()`、`destroy()`。

## 本地开发

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

## 技术边界

- 声音为 Web Audio 实时合成，不含第三方录音。
- 图形为本项目原创 SVG 几何造型，不含外部图片。
- 浏览器要求支持 Custom Elements、Shadow DOM 和 Pointer Events。
- 浏览器会要求一次用户手势后才允许播放音频，这是 Web Audio 的正常安全策略。

## License

MIT
