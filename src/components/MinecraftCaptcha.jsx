import React, { useState, useRef } from 'react';

// 游戏配方定义
const RECIPES = {
  // 步骤1: 烈焰棒 → 烈焰粉 ×2
  blaze_powder: {
    type: 'shapeless',
    ingredients: ['blaze_rod'],
    result: 'blaze_powder',
    count: 2, // 产出2个
    name: '烈焰粉'
  },
  // 步骤2: 烈焰粉 + 末影珍珠 → 末影之眼
  ender_eye: {
    type: 'shapeless',
    ingredients: ['blaze_powder', 'ender_pearl'],
    result: 'ender_eye',
    count: 1,
    name: '末影之眼'
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
    { id: 'blaze_rod', type: 'blaze_rod', count: 1 },
    { id: 'slimeball', type: 'slimeball', count: 1 },
    { id: 'ender_pearl', type: 'ender_pearl', count: 1 },
    null, null, null
  ]);

  // 合成网格 (3x3，但只需要中心1格用于无序合成)
  const [craftingGrid, setCraftingGrid] = useState(Array(9).fill(null));

  // 输出格
  const [output, setOutput] = useState(null);

  // 拖拽状态
  const [draggedItem, setDraggedItem] = useState(null);
  const [isWrong, setIsWrong] = useState(false);

  // 检查配方是否匹配
  const checkRecipe = (gridItems) => {
    // 过滤空格子
    const items = gridItems.filter(item => item !== null);
    if (items.length === 0) {
      setOutput(null);
      return;
    }

    // 获取所有物品类型和数量
    const itemTypes = items.map(item => item.type);
    const itemCounts = {};
    itemTypes.forEach(type => {
      itemCounts[type] = (itemCounts[type] || 0) + 1;
    });

    // 检查每个配方
    for (const [recipeKey, recipe] of Object.entries(RECIPES)) {
      if (recipe.type !== 'shapeless') continue;

      // 检查配方原料是否匹配
      const recipeIngredients = {};
      recipe.ingredients.forEach(ing => {
        recipeIngredients[ing] = (recipeIngredients[ing] || 0) + 1;
      });

      // 对比原料
      const ingredientKeys = Object.keys(recipeIngredients);
      const itemKeys = Object.keys(itemCounts);

      if (ingredientKeys.length === itemKeys.length &&
          ingredientKeys.every(key => recipeIngredients[key] === itemCounts[key])) {
        // 配方匹配！
        setOutput({
          type: recipe.result,
          count: recipe.count
        });
        return recipe.result;
      }
    }

    // 无匹配配方
    setOutput(null);
    return null;
  };

  // 拖拽开始
  const handleDragStart = (item, source, index) => {
    if (!item) return;
    setDraggedItem({ item, source, index });
  };

  // 放置到合成网格
  const handleDropToCrafting = (targetIndex) => {
    if (!draggedItem) return;

    const { item, source, index: sourceIndex } = draggedItem;

    if (source === 'inventory') {
      // 从库存拖到合成台
      const newInventory = [...inventory];
      const newGrid = [...craftingGrid];

      // 如果目标格子有物品，交换
      if (newGrid[targetIndex]) {
        newInventory[sourceIndex] = newGrid[targetIndex];
      } else {
        newInventory[sourceIndex] = null;
      }

      newGrid[targetIndex] = item;

      setInventory(newInventory);
      setCraftingGrid(newGrid);
      checkRecipe(newGrid);
    } else if (source === 'crafting') {
      // 在合成台内移动
      const newGrid = [...craftingGrid];
      const temp = newGrid[targetIndex];
      newGrid[targetIndex] = newGrid[sourceIndex];
      newGrid[sourceIndex] = temp;

      setCraftingGrid(newGrid);
      checkRecipe(newGrid);
    }

    setDraggedItem(null);
  };

  // 放置到库存
  const handleDropToInventory = (targetIndex) => {
    if (!draggedItem) return;

    const { item, source, index: sourceIndex } = draggedItem;

    if (source === 'crafting') {
      // 从合成台拖回库存
      const newInventory = [...inventory];
      const newGrid = [...craftingGrid];

      if (newInventory[targetIndex]) {
        newGrid[sourceIndex] = newInventory[targetIndex];
      } else {
        newGrid[sourceIndex] = null;
      }

      newInventory[targetIndex] = item;

      setInventory(newInventory);
      setCraftingGrid(newGrid);
      checkRecipe(newGrid);
    } else if (source === 'inventory') {
      // 在库存内移动
      const newInventory = [...inventory];
      const temp = newInventory[targetIndex];
      newInventory[targetIndex] = newInventory[sourceIndex];
      newInventory[sourceIndex] = temp;

      setInventory(newInventory);
    }

    setDraggedItem(null);
  };

  // 点击输出格，取出合成物品
  const handleTakeOutput = () => {
    if (!output) return;

    // 找到库存中的空格子
    const emptySlot = inventory.findIndex(slot => slot === null);
    if (emptySlot === -1) {
      alert('库存已满！');
      return;
    }

    // 清空合成网格
    setCraftingGrid(Array(9).fill(null));

    // 将输出物品放入库存
    const newInventory = [...inventory];
    newInventory[emptySlot] = {
      id: `${output.type}_${Date.now()}`,
      type: output.type,
      count: output.count
    };
    setInventory(newInventory);
    setOutput(null);
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
      { id: 'blaze_rod', type: 'blaze_rod', count: 1 },
      { id: 'slimeball', type: 'slimeball', count: 1 },
      { id: 'ender_pearl', type: 'ender_pearl', count: 1 },
      null, null, null
    ]);
    setCraftingGrid(Array(9).fill(null));
    setOutput(null);
  };

  // 渲染物品槽
  const renderSlot = (item, index, source) => {
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e) => {
      e.preventDefault();
      if (source === 'crafting') {
        handleDropToCrafting(index);
      } else {
        handleDropToInventory(index);
      }
    };

    return (
      <div
        key={`${source}-${index}`}
        className="crafting-slot"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {item && (
          <div
            className="stack-container"
            draggable
            onDragStart={() => handleDragStart(item, source, index)}
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
            <div className="crafting-grid">
              {craftingGrid.map((item, index) => renderSlot(item, index, 'crafting'))}
            </div>

            {/* 箭头 */}
            <div className="arrow-container">
              <svg className="arrow-svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.3 17.275q-.3-.3-.288-.713.013-.412.313-.712L17.15 12l-3.825-3.85q-.3-.3-.3-.712 0-.413.3-.713.3-.3.713-.3.412 0 .712.3l4.525 4.55q.15.15.213.325.062.175.062.375t-.062.375q-.063.175-.213.325L14.75 17.3q-.3.275-.7.288-.4.012-.75-.313ZM8 18q-.425 0-.713-.288Q7 17.425 7 17V7q0-.425.287-.713Q7.575 6 8 6q.425 0 .713.287Q9 6.575 9 7v10q0 .425-.287.712Q8.425 18 8 18Z"/>
              </svg>
            </div>

            {/* 输出格 */}
            <div className="output-container">
              <div
                className="crafting-slot output-slot"
                onClick={handleTakeOutput}
                style={{ cursor: output ? 'pointer' : 'default' }}
              >
                {output && (
                  <div className="stack-container">
                    <img
                      src={ITEMS[output.type]?.image}
                      alt={ITEMS[output.type]?.name}
                      draggable={false}
                      className="item-image"
                    />
                    {output.count > 1 && (
                      <span className="item-count">{output.count}</span>
                    )}
                  </div>
                )}
              </div>
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
          max-width: 500px;
          margin: 0 auto;
          background: white;
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
          cursor: pointer;
          transition: background-color 0.1s;
        }

        .crafting-slot:hover {
          background-color: #9a9a9a;
        }

        .output-slot {
          background-color: #707070;
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
        }

        .arrow-container {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #373737;
        }

        .arrow-svg {
          width: 40px;
          height: 40px;
        }

        .output-container {
          width: 60px;
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
          transition: transform 0.3s;
        }

        .captcha-refresh:hover {
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
