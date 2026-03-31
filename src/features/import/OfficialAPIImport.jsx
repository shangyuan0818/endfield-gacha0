import React, { useCallback, useState } from 'react';
import OfficialImportContent from './components/OfficialImportContent';
import { useOfficialImportController } from './useOfficialImportController';

export default function OfficialAPIImport({
  onImportComplete,
  onBack: _onBack,
  onFetchStatusChange,
  userId
}) {
  const [source, setSource] = useState('cn');

  const handleAutoSourceSwitch = useCallback((nextSource) => {
    setSource(nextSource);
  }, []);

  const {
    tokenInput,
    status,
    progress,
    statusMessage,
    importSummary,
    userInfo,
    error,
    autoDetected,
    availableAccounts,
    queueStatus,
    retryInfo,
    sourceSwitchInfo,
    handleInputChange,
    handleImport,
    handleAccountSelect,
    handleCancel,
    handleConfirmImport,
    handleReset,
  } = useOfficialImportController({
    onImportComplete,
    onFetchStatusChange,
    onSourceSwitch: handleAutoSourceSwitch,
    userId,
    source
  });

  const handleSourceChange = useCallback((nextSource) => {
    if (nextSource === source) {
      return;
    }
    handleReset();
    setSource(nextSource);
  }, [handleReset, source]);

  return (
    <OfficialImportContent
      source={source}
      status={status}
      tokenInput={tokenInput}
      autoDetected={autoDetected}
      availableAccounts={availableAccounts}
      progress={progress}
      statusMessage={statusMessage}
      queueStatus={queueStatus}
      retryInfo={retryInfo}
      sourceSwitchInfo={sourceSwitchInfo}
      error={error}
      importSummary={importSummary}
      userInfo={userInfo}
      onSourceChange={handleSourceChange}
      onTokenChange={handleInputChange}
      onStartImport={handleImport}
      onSelectAccount={handleAccountSelect}
      onCancel={handleCancel}
      onReset={handleReset}
      onConfirmImport={handleConfirmImport}
    />
  );
}
