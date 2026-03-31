import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { getDeviceRedirectTarget } from '../../utils/deviceRedirect.js';

function DeviceRedirectGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { shouldUseMobile } = useDeviceDetection();
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (cooldownRef.current) return;

    const target = getDeviceRedirectTarget(location.pathname, shouldUseMobile);
    if (!target) return;

    cooldownRef.current = true;
    navigate(target, { replace: true });

    const timer = setTimeout(() => {
      cooldownRef.current = false;
    }, 800);
    return () => clearTimeout(timer);
  }, [shouldUseMobile, location.pathname, navigate]);

  return children;
}

export default DeviceRedirectGuard;
