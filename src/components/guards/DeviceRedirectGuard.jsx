import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import { getDeviceRedirectTarget } from '../../utils/deviceRedirect.js';

function DeviceRedirectGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { shouldUseMobile } = useDeviceDetection();

  useEffect(() => {
    const target = getDeviceRedirectTarget(location.pathname, shouldUseMobile);
    if (target) {
      navigate(target, { replace: true });
    }
  }, [shouldUseMobile, location.pathname, navigate]);

  return children;
}

export default DeviceRedirectGuard;
