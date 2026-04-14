import React from 'react';
import MobileHomeHubView from './MobileHomeHubView.jsx';

/**
 * 兼容旧首页入口，统一代理到新的移动端首页实现。
 */
function MobileHomeView() {
  return <MobileHomeHubView />;
}

export default MobileHomeView;
