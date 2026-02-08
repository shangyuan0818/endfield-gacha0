import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone } from 'lucide-react';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';

/**
 * 平台切换器组件
 * 允许用户在桌面端和移动端之间切换
 */
function PlatformSwitcher({ variant = 'button', className = '' }) {
  const navigate = useNavigate();
  const { platformPreference, setPreference, isMobile } = useDeviceDetection();

  const handleSwitch = (targetPlatform) => {
    setPreference(targetPlatform);
    if (targetPlatform === 'mobile') {
      navigate('/m');
    } else {
      navigate('/');
    }
  };

  const currentPlatform = window.location.pathname.startsWith('/m') ? 'mobile' : 'desktop';

  if (variant === 'menu-item') {
    return (
      <button
        onClick={() => handleSwitch(currentPlatform === 'mobile' ? 'desktop' : 'mobile')}
        className={`flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${className}`}
      >
        {currentPlatform === 'mobile' ? (
          <>
            <Monitor className="w-5 h-5 text-zinc-500" />
            <span className="text-zinc-700 dark:text-zinc-300">切换到桌面版</span>
          </>
        ) : (
          <>
            <Smartphone className="w-5 h-5 text-zinc-500" />
            <span className="text-zinc-700 dark:text-zinc-300">切换到移动版</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => handleSwitch(currentPlatform === 'mobile' ? 'desktop' : 'mobile')}
      className={`flex items-center gap-2 px-3 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors ${className}`}
    >
      {currentPlatform === 'mobile' ? (
        <>
          <Monitor className="w-4 h-4" />
          <span>桌面版</span>
        </>
      ) : (
        <>
          <Smartphone className="w-4 h-4" />
          <span>移动版</span>
        </>
      )}
    </button>
  );
}

export default PlatformSwitcher;
