import React from 'react';
import OfficialImportContent from './components/OfficialImportContent';
import { useOfficialImportController } from './useOfficialImportController';

export default function OfficialAPIImport({
  onImportComplete,
  onBack: _onBack,
  onFetchStatusChange,
  userId
}) {
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
    handleInputChange,
    handleImport,
    handleAccountSelect,
    handleCancel,
    handleConfirmImport,
    handleReset,
  } = useOfficialImportController({
    onImportComplete,
    onFetchStatusChange,
    userId
  });

  return (
    <OfficialImportContent
      status={status}
      tokenInput={tokenInput}
      autoDetected={autoDetected}
      availableAccounts={availableAccounts}
      progress={progress}
      statusMessage={statusMessage}
      queueStatus={queueStatus}
      retryInfo={retryInfo}
      error={error}
      importSummary={importSummary}
      userInfo={userInfo}
      onTokenChange={handleInputChange}
      onStartImport={handleImport}
      onSelectAccount={handleAccountSelect}
      onCancel={handleCancel}
      onReset={handleReset}
      onConfirmImport={handleConfirmImport}
    />
  );
}
