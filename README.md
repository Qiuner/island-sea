# 造物群岛 · Island Sea

> 每个孩子都是一座岛，这片海会不断长大。

营期孩子作品门户：孩子做完的项目（网站 / 网页游戏 / 单文件 demo）变成海上的一座岛，开船探索同伴的作品；更多孩子加入 = 海上长出更多岛。

## 特性

- **微缩治愈海洋**：正交等距 + 移轴模糊，Gerstner 涌浪水面、贴岸浅滩泡沫、太阳碎金高光。
- **全天流转**：白天 → 黄昏 → 夜晚 → 黎明 随真实时间自然过渡（点击可平滑切换时段）。
- **数据驱动 30 岛**：加一个孩子 = 往 `src/data/islands.ts` 的 `CHILDREN` 加一条；没写作品 = 迷雾岛。
- **三态岛屿**：迷雾（未做完）/ 待寻获（发微光）/ 已寻获（点亮灯火）。
- **点岛聚焦**：靠近点岛 → 岛飘起、全屏聚焦 → 点漂浮宝箱打开作品（iframe 嵌入）。
- **快速前往**：点岛屿 / 点小地图 / 名录搜孩子名，即刻驶抵。
- **氛围**：Bloom 辉光、萤火虫、船尾荧光拖尾、发光水母、深夜极光、鲸豚鱼群、岛上灯塔/风车/篝火/旗帜。

## 技术栈

Vue 3 + Vite + TypeScript + 裸 three.js。两层解耦：Vue 管界面（HUD / 小地图 / 名录 / 登岛面板），three 管 3D 世界，靠 `store` 与事件回调对接。

模块（组件化后）：`world.ts`（装配 + 主循环 + 相机 + 操控）、`creatures.ts`、`timeofday.ts`、`postfx.ts`、`island.ts`、`ocean.ts`、`nightmagic.ts`、`shipfx.ts`、`config.ts` / `ease.ts` 等。

## 开发

```bash
npm install
npm run dev      # 本地开发 (端口 5175)
npm run build    # 生产构建
```

## 验证钩子

`?ship=x,z`、`?island=id`、`?unlock=all`、`?grow=id`、`?tod=0..1`、`?daycycle=N`（0=冻结）、`?noshadow`。
