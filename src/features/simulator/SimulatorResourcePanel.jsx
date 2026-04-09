import React from 'react';
import ResourceSummaryPanel from '../../components/resources/ResourceSummaryPanel';
import { useI18n } from '../../i18n/index.js';

const SimulatorResourcePanel = ({ resourceLedger }) => {
  const { t } = useI18n();

  return (
    <ResourceSummaryPanel
      title={t('simulator.toolbar.cumulative')}
      resources={resourceLedger}
      variant="all"
      className="bg-white dark:bg-endfield-dark border-zinc-200 dark:border-endfield-border"
    />
  );
};

export default SimulatorResourcePanel;
