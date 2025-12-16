import React, { useState } from 'react';

// 游戏配方定义
const RECIPES = {
  // 烈焰棒 → 烈焰粉 ×2
  blaze_powder: {
    type: 'shapeless',
    ingredients: [{ item: 'blaze_rod', count: 1 }],
    result: 'blaze_powder',
    count: 2,
    name: '烈焰粉'
  },
  // 烈焰粉 + 末影珍珠 → 末影之眼
  ender_eye: {
    type: 'shapeless',
    ingredients: [
      { item: 'blaze_powder', count: 1 },
      { item: 'ender_pearl', count: 1 }
    ],
    result: 'ender_eye',
    count: 1,
    name: '末影之眼'
  },
  // 烈焰粉 + 粘液球 → 岩浆膏 (干扰项)
  magma_cream: {
    type: 'shapeless',
    ingredients: [
      { item: 'blaze_powder', count: 1 },
      { item: 'slimeball', count: 1 }
    ],
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
  // 初始库存
  const [inventory, setInventory] = useState([
    { type: 'blaze_rod', count: 1 },
    { type: 'slimeball', count: 1 },
    { type: 'ender_pearl', count: 1 },
    null, null, null
  ]);

  // 合成网格 (3x3)
  const [craftingGrid, setCraftingGrid] = useState(Array(9).fill(null));

  // 手持物品（点击拾取的物品）
  const [heldItem, setHeldItem] = useState(null);

  // 鼠标位置（用于手持物品跟随）
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // 错误动画状态
  const [isWrong, setIsWrong] = useState(false);

  // 监听鼠标移动
  React.useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    if (heldItem) {
      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }
  }, [heldItem]);

  // 实时计算输出
  const calculateOutput = (gridItems) => {
    const items = gridItems.filter(item => item !== null);
    if (items.length === 0) return null;

    // 统计物品类型和总数量
    const itemCounts = {};
    items.forEach(item => {
      itemCounts[item.type] = (itemCounts[item.type] || 0) + item.count;
    });

    // 检查每个配方
    for (const recipe of Object.values(RECIPES)) {
      const recipeIngredients = {};
      recipe.ingredients.forEach(ing => {
        recipeIngredients[ing.item] = ing.count;
      });

      // 检查原料是否完全匹配（数量和种类）
      const ingredientTypes = Object.keys(recipeIngredients);
      const itemTypes = Object.keys(itemCounts);

      if (ingredientTypes.length !== itemTypes.length) continue;

      const match = ingredientTypes.every(type =>
        itemCounts[type] >= recipeIngredients[type]
      ) && itemTypes.every(type =>
        recipeIngredients[type] !== undefined
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

  // 左键点击格子
  const handleLeftClick = (slotType, index) => {
    if (slotType === 'output') {
      handleTakeOutput();
      return;
    }

    const slots = slotType === 'inventory' ? inventory : craftingGrid;
    const setSlots = slotType === 'inventory' ? setInventory : setCraftingGrid;
    const slotItem = slots[index];

    if (!heldItem && !slotItem) {
      // 空手点击空格子，无操作
      return;
    }

    if (!heldItem && slotItem) {
      // 空手点击有物品的格子 → 拾起全部
      const newSlots = [...slots];
      newSlots[index] = null;
      setSlots(newSlots);
      setHeldItem(slotItem);
    } else if (heldItem && !slotItem) {
      // 手持物品点击空格子 → 放下全部
      const newSlots = [...slots];
      newSlots[index] = heldItem;
      setSlots(newSlots);
      setHeldItem(null);
    } else if (heldItem && slotItem) {
      // 手持物品点击有物品的格子
      if (heldItem.type === slotItem.type) {
        // 同类物品 → 堆叠合并
        const totalCount = heldItem.count + slotItem.count;
        const maxStack = 64; // MC最大堆叠数

        if (totalCount <= maxStack) {
          // 全部合并
          const newSlots = [...slots];
          newSlots[index] = { type: slotItem.type, count: totalCount };
          setSlots(newSlots);
          setHeldItem(null);
        } else {
          // 超过最大堆叠，部分合并
          const newSlots = [...slots];
          newSlots[index] = { type: slotItem.type, count: maxStack };
          setSlots(newSlots);
          setHeldItem({ type: heldItem.type, count: totalCount - maxStack });
        }
      } else {
        // 不同类物品 → 交换
        const newSlots = [...slots];
        newSlots[index] = heldItem;
        setSlots(newSlots);
        setHeldItem(slotItem);
      }
    }
  };

  // 右键点击格子
  const handleRightClick = (e, slotType, index) => {
    e.preventDefault(); // 阻止浏览器右键菜单

    if (slotType === 'output') return; // 输出格不支持右键

    const slots = slotType === 'inventory' ? inventory : craftingGrid;
    const setSlots = slotType === 'inventory' ? setInventory : setCraftingGrid;
    const slotItem = slots[index];

    if (!heldItem && !slotItem) {
      // 空手右键空格子，无操作
      return;
    }

    if (!heldItem && slotItem) {
      // 空手右键有物品的格子 → 拾起一半（向上取整）
      const pickCount = Math.ceil(slotItem.count / 2);
      const remainCount = slotItem.count - pickCount;

      const newSlots = [...slots];
      if (remainCount > 0) {
        newSlots[index] = { type: slotItem.type, count: remainCount };
      } else {
        newSlots[index] = null;
      }
      setSlots(newSlots);
      setHeldItem({ type: slotItem.type, count: pickCount });
    } else if (heldItem && !slotItem) {
      // 手持物品右键空格子 → 放下1个
      if (heldItem.count > 1) {
        const newSlots = [...slots];
        newSlots[index] = { type: heldItem.type, count: 1 };
        setSlots(newSlots);
        setHeldItem({ type: heldItem.type, count: heldItem.count - 1 });
      } else {
        // 只剩1个，放下
        const newSlots = [...slots];
        newSlots[index] = heldItem;
        setSlots(newSlots);
        setHeldItem(null);
      }
    } else if (heldItem && slotItem) {
      // 手持物品右键有物品的格子
      if (heldItem.type === slotItem.type) {
        // 同类物品 → 放下1个（堆叠）
        const maxStack = 64;
        if (slotItem.count < maxStack && heldItem.count > 0) {
          const newSlots = [...slots];
          newSlots[index] = { type: slotItem.type, count: slotItem.count + 1 };
          setSlots(newSlots);
          if (heldItem.count > 1) {
            setHeldItem({ type: heldItem.type, count: heldItem.count - 1 });
          } else {
            setHeldItem(null);
          }
        }
      } else {
        // 不同类物品 → 交换
        const newSlots = [...slots];
        newSlots[index] = heldItem;
        setSlots(newSlots);
        setHeldItem(slotItem);
      }
    }
  };

  // 点击输出格 - 拿取合成产物
  const handleTakeOutput = () => {
    if (!output) return;

    // 找到库存空位
    const emptySlot = inventory.findIndex(slot => slot === null);
    if (emptySlot === -1) return; // 库存满

    // 消耗原料（每种配方原料只消耗需要的数量）
    const recipe = Object.values(RECIPES).find(r => r.result === output.type);
    if (!recipe) return;

    const newGrid = [...craftingGrid];

    // 消耗每种原料
    recipe.ingredients.forEach(({ item: ingredientType, count: needCount }) => {
      let remaining = needCount;

      for (let i = 0; i < newGrid.length && remaining > 0; i++) {
        if (newGrid[i] && newGrid[i].type === ingredientType) {
          const consumeCount = Math.min(newGrid[i].count, remaining);

          if (newGrid[i].count > consumeCount) {
            // 部分消耗
            newGrid[i] = { ...newGrid[i], count: newGrid[i].count - consumeCount };
          } else {
            // 完全消耗
            newGrid[i] = null;
          }

          remaining -= consumeCount;
        }
      }
    });

    // 产物进入库存
    const newInventory = [...inventory];
    newInventory[emptySlot] = {
      type: output.type,
      count: output.count
    };

    setInventory(newInventory);
    setCraftingGrid(newGrid);
  };

  // 验证
  const handleVerify = () => {
    const hasEnderEye = inventory.some(item => item && item.type === 'ender_eye');

    if (hasEnderEye) {
      if (onVerified) onVerified();
    } else {
      setIsWrong(true);
      setTimeout(() => setIsWrong(false), 750);
    }
  };

  // 刷新
  const handleRefresh = () => {
    setInventory([
      { type: 'blaze_rod', count: 1 },
      { type: 'slimeball', count: 1 },
      { type: 'ender_pearl', count: 1 },
      null, null, null
    ]);
    setCraftingGrid(Array(9).fill(null));
    setHeldItem(null);
  };

  // 渲染物品槽
  const renderSlot = (item, index, slotType) => {
    const isOutput = slotType === 'output';

    return (
      <div
        key={`${slotType}-${index}`}
        className={`crafting-slot ${isOutput ? 'output-slot' : ''}`}
        onClick={() => !isOutput && handleLeftClick(slotType, index)}
        onContextMenu={(e) => !isOutput && handleRightClick(e, slotType, index)}
        style={{ cursor: 'pointer' }}
      >
        {item && (
          <div className="stack-container">
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
      {/* 手持物品（跟随鼠标） */}
      {heldItem && (
        <div
          className="held-item"
          style={{
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: 10000,
            left: `${mousePos.x}px`,
            top: `${mousePos.y}px`,
            transform: 'translate(-50%, -50%)',
            width: '48px',
            height: '48px'
          }}
        >
          <div className="stack-container">
            <img
              src={ITEMS[heldItem.type]?.image}
              alt={ITEMS[heldItem.type]?.name}
              className="item-image"
              style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
            />
            {heldItem.count > 1 && (
              <span className="item-count">{heldItem.count}</span>
            )}
          </div>
        </div>
      )}

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

      {/* 提示文本 */}
      <div className="hint-text">
        <div className="text-xs text-gray-600 text-center">
          💡 左键点击: 拿起/放下全部 · 右键点击: 拿起/放下一半
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
          box-shadow: 0 1px 3px 1px rgba(0, 0, 0, 0.06);
          font-family: 'Microsoft YaHei', 'Roboto', sans-serif;
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
          font-size: 16px;
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

        .crafting-slot:hover {
          background-color: #9a9a9a;
        }

        .output-slot {
          background-color: #707070;
        }

        .output-slot:hover {
          background-color: #808080;
        }

        .stack-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
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
          color: #373737;
          flex-shrink: 0;
        }

        .arrow-svg {
          width: 40px;
          height: 40px;
        }

        .output-container {
          width: 60px;
        }

        .hint-text {
          padding: 0 20px 10px;
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
        }

        .verify-button:hover {
          background-color: #f59e0b;
        }

        .verify-button:active {
          transform: scale(0.98);
        }

        .verify-button-wrong {
          animation: wrongShake 0.25s ease-in-out 3;
          background-color: #ef4444 !important;
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
