# 造物群岛 · Island Sea

> 每个孩子都是一座岛，这片海会不断长大。

营期孩子作品门户：孩子做完的项目（网站 / 网页游戏 / 单文件 demo）变成海上的一座岛，开船探索同伴的作品；更多孩子加入 = 海上长出更多岛。

## 特性

- **微缩治愈海洋**：正交等距 + 移轴模糊，Gerstner 涌浪水面、贴岸浅滩泡沫、太阳碎金高光。
- **全天流转**：白天 → 黄昏 → 夜晚 → 黎明 随真实时间自然过渡（点击可平滑切换时段）。
- **后台数据驱动**：从 `future-maker-admin` 的公开接口加载已发布岛屿；管理员在若依后台维护孩子和作品链接。
- **三态岛屿**：迷雾（未做完）/ 待寻获（发微光）/ 已寻获（点亮灯火）。
- **点岛聚焦**：靠近点岛 → 岛飘起、全屏聚焦 → 点漂浮宝箱在新窗口打开作品。
- **快速前往**：点岛屿 / 点小地图 / 名录搜孩子名，即刻驶抵。
- **氛围**：Bloom 辉光、萤火虫、船尾荧光拖尾、发光水母、深夜极光、鲸豚鱼群、岛上灯塔/风车/篝火/旗帜。

## 技术栈

Vue 3 + Vite + TypeScript + 裸 three.js。两层解耦：Vue 管界面（HUD / 小地图 / 名录 / 登岛面板），three 管 3D 世界，靠 `store` 与事件回调对接。

模块（组件化后）：`world.ts`（装配 + 主循环 + 相机 + 操控）、`creatures.ts`、`timeofday.ts`、`postfx.ts`、`island.ts`、`ocean.ts`、`nightmagic.ts`、`shipfx.ts`、`config.ts` / `ease.ts` 等。

## 开发

```bash
npm install
npm run dev      # 本地开发 (端口 5175)
npm run test     # 岛屿布局回归测试
npm run build    # 类型检查 + 生产构建
npm run check    # 提交前完整检查
```

开发服务器把 `/api` 代理到 `http://localhost:8080`。后端不可用时，开发环境会使用三座无作品的演示岛；生产构建不会回退演示数据。

环境变量：

```env
VITE_API_BASE_URL=/api
VITE_ADMIN_URL=http://localhost
```

## 数据接口

官网读取若依后端匿名接口：

```text
GET /open/islands
```

接口只返回后台已发布的岛屿和已启用的作品。岛屿坐标由官网根据稳定 ID 和排序自动生成，后台不需要维护 Three.js 坐标；在列表末尾新增岛屿不会改变已有岛屿的位置。

## Docker 部署

官网使用独立 Nginx 静态容器：

```bash
cp .env.example .env
docker compose up -d --build
```

默认访问 `http://localhost:5176`。主要配置：

```env
ADMIN_URL=https://admin.example.com/login
BACKEND_URL=https://admin.example.com/prod-api
```

浏览器请求 `/api/open/islands`，官网容器再反向代理到 `BACKEND_URL/open/islands`，因此浏览器侧不需要跨域配置。

## 验证钩子

`?ship=x,z`、`?island=id`、`?unlock=all`、`?grow=id`、`?tod=0..1`、`?daycycle=N`（0=冻结）、`?noshadow`。
