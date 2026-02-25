import React, { useState } from 'react'
import GachaAnalyzer from './GachaAnalyzer'
import LoadingScreen from './LoadingScreen'
import { ErrorBoundary } from './components'
import { ThemeProvider } from './contexts/ThemeContext'

function App() {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <ThemeProvider>
      <ErrorBoundary>
        {isLoading && (
          <LoadingScreen onComplete={() => setIsLoading(false)} />
        )}
        <div className={`App ${isLoading ? 'hidden' : 'block'}`}>
          <GachaAnalyzer />
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export default App
