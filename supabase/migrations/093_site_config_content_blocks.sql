-- 093: 将硬编码的首页/关于页运营内容迁移到 site_config (ARCH-023)

INSERT INTO site_config (key, value, label, category) VALUES
  (
    'home_roadmap_items',
    '[{"id":"sim-inherit","icon":"RefreshCw","title":"模拟器状态继承","description":"卡池模拟器支持继承游戏内的真实抽卡与保底状态","status":"completed","priority":"high"},{"id":"puzzle-captcha","icon":"Shield","title":"拼图验证码","description":"主站验证码已切换为简单拼图玩法，并保留备用方式","status":"completed","priority":"high"},{"id":"global-support","icon":"Globe","title":"国际服支持","description":"现已支持国际服抽卡记录的解析与导入","status":"completed","priority":"high"},{"id":"currency-calc","icon":"Calculator","title":"资源消耗换算","description":"现已支持换算已消耗合成玉、源石数量及武库配额","status":"completed","priority":"medium"},{"id":"sim-currency","icon":"Database","title":"模拟器资源机制","description":"模拟器已加入合成玉、源石与武库配额机制","status":"completed","priority":"medium"},{"id":"share","icon":"Share2","title":"分享功能","description":"模拟器支持脱敏分享卡图片、系统分享与文本复制","status":"completed","priority":"medium"},{"id":"i18n","icon":"Languages","title":"国际化支持","description":"支持英语、日语等多语言界面，服务更多玩家","status":"planned","priority":"low"},{"id":"a11y","icon":"Accessibility","title":"无障碍优化","description":"完善ARIA标签和键盘导航，提升可访问性","status":"planned","priority":"low"},{"id":"virtual-scroll","icon":"Database","title":"虚拟滚动","description":"优化长列表性能，支持更大数据量的流畅浏览","status":"planned","priority":"low"}]',
    '首页路线图条目',
    'content'
  ),
  (
    'home_friendly_links',
    '[{"title":"一图流攒抽计算器","url":"https://ef.yituliu.cn/tools/gacha-calculator","icon":"BarChart3","label":"RESOURCE PLANNER"},{"title":"终末地地图（1）","url":"https://opendfieldmap.cn/","icon":"Map","label":"OPEN WORLD MAP"},{"title":"终末地地图（笋干）","url":"https://www.zmdmap.com/","icon":"Map","label":"GAME MAP WIKI"},{"title":"同样优秀的抽卡记录分析（还有舟本体的）","url":"https://endgacha.kwer.top/","icon":"BarChart3","label":"GACHA ANALYZER"}]',
    '首页友情链接',
    'content'
  ),
  (
    'about_features',
    '[{"icon":"Star","label":"卡池管理","desc":"限定/常驻/武器池"},{"icon":"Calculator","label":"抽卡模拟","desc":"真实概率 + 机制复刻"},{"icon":"BarChart3","label":"欧非分析","desc":"不歪率/平均出货"},{"icon":"Cloud","label":"云端缓存","desc":"三级降级策略加速"},{"icon":"Download","label":"数据导入","desc":"批量粘贴 + OCR预告"},{"icon":"Shield","label":"全球统计","desc":"\"急\"按钮实时同步"}]',
    '关于页功能特性列表',
    'content'
  ),
  (
    'about_disclaimer',
    '非官方工具。与 Gryphline / HyperGryph 无关。',
    '关于页免责声明',
    'content'
  ),
  (
    'home_hero_slogan',
    '记录抽卡历程，查看卡池分析、统计汇总与模拟器数据。',
    '首页 Hero 标语',
    'content'
  ),
  (
    'qq_group_number',
    '1080983185',
    'QQ 群号',
    'social'
  )
ON CONFLICT (key) DO NOTHING;
