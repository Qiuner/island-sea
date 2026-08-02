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

官网主站使用独立 Nginx 静态容器；需要服务端 API 的孩子作品使用独立应用容器，并通过官网 Nginx 挂载到 `/works/**`：

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

与后台部署在同一台生产服务器时，使用生产 Compose 让官网加入后台 Docker 网络，并只在宿主机回环地址暴露诊断端口：

```bash
IMAGE_TAG=2026.08.02.1 \
IDEA_IMAGE_TAG=2026.08.02.1 \
BACKEND_URL=http://app:8080 \
ADMIN_NETWORK=future-maker-admin_future-maker-admin \
docker compose -f deploy/docker-compose.prod.yml up -d --no-build
```

后台 Nginx 将 `/island/` 转发到官网容器，并仅将 `/api/open/islands` 转发到官网 API 代理。

## 第一期作品

`APortfolioOfWorks` 中的孩子作品随官网镜像一起发布：

| 作品 | 类型 | 容器内路径 | 公网路径 |
| --- | --- | --- | --- |
| 星球派对：圆滚冒险 | React + Three.js/Vite，Docker 使用 Node.js 20 和 pnpm 9.4 构建 | `/works/planet-party/` | `/island/works/planet-party/` |
| 全国 5A 景区探索地图 | 原生 HTML/CSS/JavaScript + ECharts | `/works/scenic-map/` | `/island/works/scenic-map/` |
| IdeaPilot 想法明确工具 | Vinext + React 19 + Node.js 22，独立服务端容器调用 DeepSeek | `/works/idea-pilot/` | `/island/works/idea-pilot/` |
| 云游·东方明珠 | 原生 HTML/CSS/JavaScript + Three.js，依赖随官网镜像本地托管 | `/works/oriental-pearl/` | `/island/works/oriental-pearl/` |

作品 URL 由后台“官网岛屿”维护。新增需要编译的纯前端作品时，应在 Dockerfile 中增加独立构建阶段；需要服务端 API 的作品使用独立 Dockerfile 和 Compose 服务。纯静态作品只复制运行所需文件，不复制 `.git`、开发服务器或依赖目录。

## 验证钩子

`?ship=x,z`、`?island=id`、`?unlock=all`、`?grow=id`、`?tod=0..1`、`?daycycle=N`（0=冻结）、`?noshadow`。
