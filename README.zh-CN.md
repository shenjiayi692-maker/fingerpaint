<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="Magic Finger Paint uses a camera-tracked pinch gesture to draw colorful strokes in the air">
</p>

<p align="center">
  <a href="https://ai.studio/apps/488c6e7e-e67f-49db-ba8e-d10f53e90cce"><strong>在 Google AI Studio 中打开</strong></a>
</p>

<p align="center"><a href="./README.md">English</a> · <strong>中文</strong></p>

给小孩的画画应用都要一块能摸的屏幕和一支会弄丢的触控笔。这个只要一只手——在空中捏一下手指就能画，用的是你本来就有的摄像头。

举起一只手，拇指和食指捏合就开始画，张开就停。MediaPipe 在浏览器里做手部关键点追踪，一块持久画布把捏合的轨迹变成彩色的画。

```bash
git clone https://github.com/shenjiayi692-maker/fingerpaint && cd fingerpaint && npm i && npm run dev
```

不需要 API key，也不需要后端——画画流程完全在浏览器里跑。

## 一个手势，一整块画布

- 捏合画画，松开抬笔
- 可独立追踪两只手
- 八种颜色、四种笔刷粗细
- 可切换橡皮擦或清空画布
- 六个简单描摹模板：太阳、房子、爱心、星星、云、猫
- 把完成的画导出为 PNG
- 界面支持中英文

摄像头画面做了镜像，所以动作感觉是自然的。关键点位置在落笔前会先平滑处理，另有一个短暂的捏合宽限窗口，减少追踪瞬间抖动时笔画断开。

## 本地运行

前置条件：Node.js，以及一个能访问摄像头的浏览器。

```bash
npm install
npm run dev
```

打开本地 URL，允许摄像头权限，把一只手举进画面，然后捏合拇指和食指。绘画流程不需要任何后端。

验证改动：

```bash
npm run lint
npm run build
```

## 怎么搭起来的

| 部分 | 作用 |
| --- | --- |
| MediaPipe Hands | 在浏览器里检测手部关键点和捏合距离 |
| Canvas 2D | 镜像摄像头画面、绘制关键点反馈、保存笔画 |
| React + TypeScript | 协调摄像头状态、工具、模板、引导和导出 |
| Motion | 处理轻量的界面过渡 |
| Vite | 本地开发与生产构建 |

应用会请求摄像头权限。绘画本身不需要上传视频流；手部推理和画布渲染都在浏览器里完成。

## 交互细节

- 默认追踪两只手，检测和追踪置信度都设为 `0.7`。
- 捏合阈值在归一化关键点坐标下是 `0.04`。
- 切换模板时，如果画布非空会先询问是否保存。
- MediaPipe 的资源在运行时从 jsDelivr 加载，所以首次启动需要网络。

## 项目状态

这是一个实验性的创作玩具。摄像头画质、光线、浏览器支持和设备性能都会影响追踪效果。它不是为无障碍输入设计的，也不能替代专业的辅助技术。

## 许可

MIT,见 [LICENSE](./LICENSE)。
