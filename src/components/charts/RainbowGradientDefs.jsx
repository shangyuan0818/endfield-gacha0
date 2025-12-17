import React from 'react';

/**
 * 彩虹渐变 SVG 定义组件（用于 Recharts 图表）
 * 使用方法：在 PieChart 或 BarChart 内部添加 <RainbowGradientDefs />
 * 然后在 fill 属性中使用 'url(#rainbowGradient)'
 */
const RainbowGradientDefs = () => (
  <defs>
    <linearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#f472b6" />
      <stop offset="25%" stopColor="#c084fc" />
      <stop offset="50%" stopColor="#818cf8" />
      <stop offset="75%" stopColor="#38bdf8" />
      <stop offset="100%" stopColor="#34d399" />
    </linearGradient>
  </defs>
);

export default RainbowGradientDefs;
