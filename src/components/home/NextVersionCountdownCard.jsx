import React from 'react';
import CountdownTimer from './CountdownTimer.jsx';

const NextVersionCountdownCard = React.memo(function NextVersionCountdownCard({
  targetDate,
  title,
  subTitle,
  endedText,
  scheduleLabel,
}) {
  if (!targetDate) {
    return null;
  }

  return (
    <CountdownTimer
      targetDate={targetDate}
      title={title}
      subTitle={subTitle}
      customEndedContent={endedText ? <span>{endedText}</span> : null}
      size="small"
      scheduleDate={targetDate}
      scheduleLabel={scheduleLabel}
    />
  );
});

export default NextVersionCountdownCard;
