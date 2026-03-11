import React from 'react';
import ResourceSummaryPanel from '../../components/resources/ResourceSummaryPanel';

const SimulatorResourcePanel = ({ resourceLedger }) => (
  <ResourceSummaryPanel
    title="累计资源统计"
    resources={resourceLedger}
    variant="all"
    className="bg-white dark:bg-endfield-dark border-zinc-200 dark:border-endfield-border"
  />
);

export default SimulatorResourcePanel;
