import React, { useState } from 'react';

// 游戏配方定义
const RECIPES = {
  // 正确路径: 烈焰棒 → 烈焰粉 ×2
  blaze_powder: {
    type: 'shapeless',
    ingredients: ['blaze_rod'],
    result: 'blaze_powder',
    count: 2,
    name: '烈焰粉'
  },
  // 正确路径: 烈焰粉 + 末影珍珠 → 末影之眼
  ender_eye: {
    type: 'shapeless',
    ingredients: ['blaze_powder', 'ender_pearl'],
    result: 'ender_eye',
    count: 1,
    name: '末影之眼'
  },
  // 错误路径: 烈焰粉 + 粘液球 → 岩浆膏 (干扰项)
  magma_cream: {
    type: 'shapeless',
    ingredients: ['blaze_powder', 'slimeball'],
    result: 'magma_cream',
    count: 1,
    name: '岩浆膏'
  }
};

// 物品定义
const ITEMS = {
  blaze_rod: { name: '烈焰棒', image: '/captcha/items/Blaze_Rod_JE1_BE1.png' },
  blaze_powder: { name: '烈焰粉', image: '/captcha/items/Blaze_Powder_JE2_BE1.png' },
  ender_pearl: { name: '末影珍珠', image: '/captcha/items/Ender_Pearl_JE2_BE2.png' },
  ender_eye: { name: '末影之眼', image: '/captcha/items/Eye_of_Ender_JE2_BE2.png' },
  slimeball: { name: '粘液球', image: '/captcha/items/Slimeball_JE2_BE2.png' },
  magma_cream: { name: '岩浆膏', image: '/captcha/items/Magma_Cream_JE2_BE2.png' }
};

const MinecraftCaptcha = ({ onVerified }) => {
  // 初始库存: 烈焰棒、粘液球、末影珍珠
  const [inventory, setInventory] = useState([
    { id: 'inv_0', type: 'blaze_rod', count: 1 },
    { id: 'inv_1', type: 'slimeball', count: 1 },
    { id: 'inv_2', type: 'ender_pearl', count: 1 },
    null, null, null
  ]);

  // 合成网格 (3x3)
  const [craftingGrid, setCraftingGrid] = useState(Array(9).fill(null));

  // 输出格（自动计算，不存储）
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragSource, setDragSource] = useState(null); // { type: 'inventory'|'crafting', index: number }
  const [isWrong, setIsWrong] = useState(false);

  // 实时计算输出（类似真实MC）
  const calculateOutput = (gridItems) => {
    // 过滤空格子
    const items = gridItems.filter(item => item !== null);
    if (items.length === 0) return null;

    // 统计物品类型和数量
    const itemCounts = {};
    items.forEach(item => {
      itemCounts[item.type] = (itemCounts[item.type] || 0) + item.count;
    });

    // 检查每个配方
    for (const recipe of Object.values(RECIPES)) {
      const recipeIngredients = {};
      recipe.ingredients.forEach(ing => {
        recipeIngredients[ing] = (recipeIngredients[ing] || 0) + 1;
      });

      // 对比原料
      const match = Object.keys(recipeIngredients).every(key =>
        itemCounts[key] >= recipeIngredients[key]
      ) && Object.keys(itemCounts).every(key =>
        recipeIngredients[key] >= itemCounts[key]
      );

      if (match) {
        return {
          type: recipe.result,
          count: recipe.count,
          name: recipe.name
        };
      }
    }

    return null;
  };

  const output = calculateOutput(craftingGrid);

  // 拖拽开始
  const handleDragStart = (e, item, sourceType, sourceIndex) => {
    if (!item) return;
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem(item);
    setDragSource({ type: sourceType, index: sourceIndex });
  };

  // 放置处理
  const handleDrop = (e, targetType, targetIndex) => {
    e.preventDefault();
    if (!draggedItem || !dragSource) return;

    const { type: sourceType, index: sourceIndex } = dragSource;

    // 从库存拖到合成台
    if (sourceType === 'inventory' && targetType === 'crafting') {
      const newInventory = [...inventory];
      const newGrid = [...craftingGrid];

      // 交换物品
      const temp = newGrid[targetIndex];
      newGrid[targetIndex] = draggedItem;
      newInventory[sourceIndex] = temp;

      setInventory(newInventory);
      setCraftingGrid(newGrid);
    }

    // 从合成台拖回库存
    else if (sourceType === 'crafting' && targetType === 'inventory') {
      const newInventory = [...inventory];
      const newGrid = [...craftingGrid];

      // 尝试堆叠合并
      if (newInventory[targetIndex] &&
          newInventory[targetIndex].type === draggedItem.type) {
        // 同类物品，合并数量
        newInventory[targetIndex] = {
          ...newInventory[targetIndex],
          count: newInventory[targetIndex].count + draggedItem.count
        };
        newGrid[sourceIndex] = null;
      } else {
        // 交换物品
        const temp = newInventory[targetIndex];
        newInventory[targetIndex] = draggedItem;
        newGrid[sourceIndex] = temp;
      }

      setInventory(newInventory);
      setCraftingGrid(newGrid);
    }

    // 合成台内移动
    else if (sourceType === 'crafting' && targetType === 'crafting') {
      const newGrid = [...craftingGrid];
      const temp = newGrid[targetIndex];
      newGrid[targetIndex] = draggedItem;
      newGrid[sourceIndex] = temp;
      setCraftingGrid(newGrid);
    }

    // 库存内移动
    else if (sourceType === 'inventory' && targetType === 'inventory') {
      const newInventory = [...inventory];

      // 尝试堆叠合并
      if (newInventory[targetIndex] &&
          newInventory[targetIndex].type === draggedItem.type) {
        newInventory[targetIndex] = {
          ...newInventory[targetIndex],
          count: newInventory[targetIndex].count + draggedItem.count
        };
        newInventory[sourceIndex] = null;
      } else {
        const temp = newInventory[targetIndex];
        newInventory[targetIndex] = draggedItem;
        newInventory[sourceIndex] = temp;
      }

      setInventory(newInventory);
    }

    setDraggedItem(null);
    setDragSource(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // 点击输出格 - 关键改进：自动消耗原料并放入库存
  const handleTakeOutput = () => {
    if (!output) return;

    // 找到库存中的空格子或可堆叠的同类物品
    let targetSlot = -1;

    // 优先查找同类物品堆叠
    for (let i = 0; i < inventory.length; i++) {
      if (inventory[i] && inventory[i].type === output.type) {
        targetSlot = i;
        break;
      }
    }

    // 如果没有同类物品，找空格子
    if (targetSlot === -1) {
      targetSlot = inventory.findIndex(slot => slot === null);
    }

    if (targetSlot === -1) {
      // 库存已满，无法拿取
      return;
    }

    // 消耗合成网格中的原料（每种-1）
    const newGrid = [...craftingGrid];
    const consumed = new Set();

    // 获取配方所需原料
    const recipe = Object.values(RECIPES).find(r => r.result === output.type);
    if (!recipe) return;

    // 消耗每种原料1个
    recipe.ingredients.forEach(ingredientType => {
      if (consumed.has(ingredientType)) return;

      for (let i = 0; i < newGrid.length; i++) {
        if (newGrid[i] && newGrid[i].type === ingredientType) {
          if (newGrid[i].count > 1) {
            newGrid[i] = { ...newGrid[i], count: newGrid[i].count - 1 };
          } else {
            newGrid[i] = null;
          }
          consumed.add(ingredientType);
          break;
        }
      }
    });

    // 将产物放入库存
    const newInventory = [...inventory];
    if (newInventory[targetSlot] && newInventory[targetSlot].type === output.type) {
      // 堆叠
      newInventory[targetSlot] = {
        ...newInventory[targetSlot],
        count: newInventory[targetSlot].count + output.count
      };
    } else {
      // 新物品
      newInventory[targetSlot] = {
        id: `item_${Date.now()}`,
        type: output.type,
        count: output.count
      };
    }

    setInventory(newInventory);
    setCraftingGrid(newGrid);
  };

  // 验证按钮点击
  const handleVerify = () => {
    // 检查库存中是否有末影之眼
    const hasEnderEye = inventory.some(item => item && item.type === 'ender_eye');

    if (hasEnderEye) {
      // 验证成功！
      if (onVerified) {
        onVerified();
      }
    } else {
      // 验证失败，显示错误动画
      setIsWrong(true);
      setTimeout(() => setIsWrong(false), 750);
    }
  };

  // 刷新重置
  const handleRefresh = () => {
    setInventory([
      { id: 'inv_0', type: 'blaze_rod', count: 1 },
      { id: 'inv_1', type: 'slimeball', count: 1 },
      { id: 'inv_2', type: 'ender_pearl', count: 1 },
      null, null, null
    ]);
    setCraftingGrid(Array(9).fill(null));
    setDraggedItem(null);
    setDragSource(null);
  };

  // 渲染物品槽
  const renderSlot = (item, index, sourceType) => {
    const isOutput = sourceType === 'output';
    const isDragging = dragSource && dragSource.type === sourceType && dragSource.index === index;

    return (
      <div
        key={`${sourceType}-${index}`}
        className={`crafting-slot ${isOutput ? 'output-slot' : ''} ${isDragging ? 'dragging' : ''}`}
        onDragOver={!isOutput ? handleDragOver : undefined}
        onDrop={!isOutput ? (e) => handleDrop(e, sourceType, index) : undefined}
        onClick={isOutput && item ? handleTakeOutput : undefined}
        style={{ cursor: isOutput && item ? 'pointer' : 'default' }}
      >
        {item && (
          <div
            className="stack-container"
            draggable={!isOutput}
            onDragStart={!isOutput ? (e) => handleDragStart(e, item, sourceType, index) : undefined}
          >
            <img
              src={ITEMS[item.type]?.image}
              alt={ITEMS[item.type]?.name}
              draggable={false}
              className="item-image"
            />
            {item.count > 1 && (
              <span className="item-count">{item.count}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="minecraft-captcha-container">
      {/* 标题 */}
      <div className="captcha-title">
        <div className="text-sm">[ ORACLE 身份验证系统 ]</div>
        <div className="captcha-title-type">合成 末影之眼</div>
      </div>

      {/* 合成区域 */}
      <div className="captcha-content">
        {/* 合成台 */}
        <div className="crafting-area">
          <div className="crafting-header">合成台 Crafting</div>
          <div className="crafting-table">
            {/* 3x3网格 */}
            <div className="crafting-grid">
              {craftingGrid.map((item, index) => renderSlot(item, index, 'crafting'))}
            </div>

            {/* 箭头 */}
            <div className="arrow-container">
              <svg className="arrow-svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.3 17.275q-.3-.3-.288-.713.013-.412.313-.712L17.15 12l-3.825-3.85q-.3-.3-.3-.712 0-.413.3-.713.3-.3.713-.3.412 0 .712.3l4.525 4.55q.15.15.213.325.062.175.062.375t-.062.375q-.063.175-.213.325L14.75 17.3q-.3.275-.7.288-.4.012-.75-.313ZM8 18q-.425 0-.713-.288Q7 17.425 7 17V7q0-.425.287-.713Q7.575 6 8 6q.425 0 .713.287Q9 6.575 9 7v10q0 .425-.287.712Q8.425 18 8 18Z"/>
              </svg>
            </div>

            {/* 输出格 - 实时显示配方结果 */}
            <div className="output-container">
              {renderSlot(output, 0, 'output')}
            </div>
          </div>
        </div>

        {/* 库存 */}
        <div className="inventory-area">
          <div className="crafting-header">库存 Inventory</div>
          <div className="inventory-grid">
            {inventory.map((item, index) => renderSlot(item, index, 'inventory'))}
          </div>
        </div>
      </div>

      {/* 控制栏 */}
      <div className="captcha-controls">
        <img
          src="/captcha/items/refresh.svg"
          alt="刷新"
          className="captcha-refresh"
          onClick={handleRefresh}
          title="重置"
        />
        <button
          className={`verify-button ${isWrong ? 'verify-button-wrong' : ''}`}
          onClick={handleVerify}
        >
          验证 VERIFY
        </button>
      </div>

      {/* 样式 */}
      <style jsx>{`
        .minecraft-captcha-container {
          border: 1px solid #d3d3d3;
          border-radius: 0;
          box-shadow: 0 1px 3px 1px rgba(0, 0, 0, 0.06);
          font-family: 'Microsoft YaHei', 'Roboto', sans-serif;
          font-weight: 400;
          max-width: 500px;
          margin: 0 auto;
          background: white;
          user-select: none;
        }

        .captcha-title {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: #000;
          padding: 16px;
          text-align: center;
        }

        .captcha-title-type {
          font-size: 20px;
          font-weight: 700;
          margin-top: 4px;
        }

        .captcha-content {
          padding: 20px;
        }

        .crafting-area, .inventory-area {
          margin-bottom: 20px;
        }

        .crafting-header {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 10px;
          color: #333;
        }

        .crafting-table {
          display: flex;
          align-items: center;
          gap: 20px;
          justify-content: center;
        }

        .crafting-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          width: 180px;
        }

        .inventory-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 0;
          width: 100%;
        }

        .crafting-slot {
          aspect-ratio: 1 / 1;
          background-color: #8b8b8b;
          border: 2.5px solid;
          border-color: #373737 #fff #fff #373737;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: background-color 0.1s;
        }

        .crafting-slot:not(.output-slot) {
          cursor: grab;
        }

        .crafting-slot:not(.output-slot):active {
          cursor: grabbing;
        }

        .crafting-slot:hover:not(.output-slot) {
          background-color: #9a9a9a;
        }

        .crafting-slot.dragging {
          opacity: 0.5;
          background-color: #6b6b6b;
        }

        .output-slot {
          background-color: #707070;
          cursor: pointer;
        }

        .output-slot:hover {
          background-color: #808080;
          transform: scale(1.05);
        }

        .stack-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          user-select: none;
        }

        .item-image {
          max-width: 75%;
          max-height: 75%;
          image-rendering: pixelated;
          pointer-events: none;
        }

        .item-count {
          position: absolute;
          bottom: 2px;
          right: 4px;
          color: #fff;
          font-size: 14px;
          font-weight: bold;
          text-shadow: 2px 2px 0 #000;
          font-family: 'Monocraft', monospace;
        }

        .arrow-container {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #373737;
          flex-shrink: 0;
        }

        .arrow-svg {
          width: 40px;
          height: 40px;
        }

        .output-container {
          width: 60px;
          flex-shrink: 0;
        }

        .captcha-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          border-top: 1px solid #d3d3d3;
          background: #f5f5f5;
        }

        .captcha-refresh {
          width: 24px;
          height: 24px;
          cursor: pointer;
          transition: transform 0.5s;
          opacity: 0.7;
        }

        .captcha-refresh:hover {
          opacity: 1;
          transform: rotate(180deg);
        }

        .verify-button {
          background-color: #fbbf24;
          border: none;
          color: #000;
          cursor: pointer;
          font-size: 17px;
          font-weight: 700;
          padding: 10px 30px;
          transition: all 0.15s;
          text-transform: uppercase;
          border-radius: 2px;
        }

        .verify-button:hover {
          background-color: #f59e0b;
          transform: scale(1.05);
        }

        .verify-button:active {
          transform: scale(0.98);
        }

        .verify-button-wrong {
          animation: wrongShake 0.25s ease-in-out 3;
          background-color: #ef4444 !important;
          pointer-events: none;
        }

        @keyframes wrongShake {
          0% { transform: rotate(0deg); }
          25% { transform: rotate(6deg); }
          50% { transform: rotate(0deg); }
          75% { transform: rotate(-6deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  );
};

export default MinecraftCaptcha;
