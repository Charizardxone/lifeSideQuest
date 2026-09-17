# SideQuest 小镇素材

- `town-dusk.png`：2026-09-16 使用内置 ImageGen 生成的项目专用插画。用于任务面板，并通过 CSS 定位同一旅人作为头像，保证角色、场景像素比例一致。没有使用外部图库或 emoji 插画。
- 原始生成文件保留于生成工具目录；项目直接引用此目录内副本。
- `../fonts/pixelify-sans.ttf`：Google Fonts 分发的 Pixelify Sans，Copyright 2021 The Pixelify Sans Project Authors，SIL Open Font License 1.1；完整许可见 `../fonts/OFL.txt`。来源： https://github.com/google/fonts/tree/main/ofl/pixelifysans 。仅用于短英文标签、等级及数值，中文回退到清晰的系统字体。
- 图片和字体都进入 PWA 预缓存；不请求第三方 CDN。

## 最终生成提示词

工具模式：内置 `image_gen`，非 CLI。

> Use case: illustration-story. Asset type: wide decorative illustration for SideQuest life adventure app, not a UI mockup. Create an exquisitely crafted warm 16-bit pixel art small town at dusk, a cozy bookshop with lit windows, quiet street, amber street lamp, leafy trees, and one small backpack-wearing adventurer in the center foreground. Cream, honey yellow, grass green, soft brown and muted navy palette. Wide horizontal composition, consistent clearly visible pixel scale, crisp pixel edges, no gradients or blur, restrained details legible when displayed 700px wide and 150px tall. No words, lettering, watermark or interface. This is a welcoming real-life adventure, no combat or fantasy weapons. Output one landscape image.
