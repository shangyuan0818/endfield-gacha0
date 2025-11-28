# Endfield Gacha Analyzer (终末地抽卡分析器)

一个基于 React 的本地化抽卡记录分析工具，专为《明日方舟：终末地》（预测机制）设计。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-61DAFB.svg)
![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg)

## ✨ 核心功能

*   **多卡池支持**：完整支持 **限定角色池** (120硬保/240井)、**武器池** (80硬保/交替井) 和 **常驻池** (300自选)。
*   **数据可视化**：
    *   **看板**：实时展示各稀有度占比、不歪率、距离保底抽数。
    *   **汇总**：全账号生涯统计，包含分卡池的稀有度饼图和出货垫刀分布堆叠柱状图。
*   **高效录入**：
    *   **十连编辑器**：极速点选录入，自动识别保底机制。
    *   **智能补全**：新建卡池时自动根据历史记录推断“抽卡人”名称。
*   **数据安全**：
    *   **本地存储**：所有数据仅保存在浏览器 LocalStorage 中，无后端服务器，绝对隐私安全。
    *   **导入/导出**：支持导出 JSON 备份或 CSV 表格数据。

## 🚀 快速开始

### 在线使用 (如果已部署)
直接访问部署后的 URL 即可使用。

### 本地运行

1.  克隆项目：
    ```bash
    git clone https://github.com/your-username/endfield-gacha-analyzer.git
    ```
2.  安装依赖：
    ```bash
    cd gacha-analyzer
    npm install
    ```
3.  启动开发服务器：
    ```bash
    npm run dev
    ```
4.  构建生产版本：
    ```bash
    npm run build
    ```

## 🛠️ 技术栈

*   **核心框架**: React 18 + Vite
*   **UI 样式**: Tailwind CSS v4
*   **图表库**: Recharts
*   **图标库**: Lucide React

## 📂 目录结构

*   `src/GachaAnalyzer.jsx`: 核心业务逻辑与 UI 组件。
*   `src/components`: (内部组件已通过 React.memo 优化)

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进此工具！

---
*注：本项目为粉丝自制工具，与官方游戏无关。抽卡机制基于现有网络信息推测，实际请以游戏上线为准。*