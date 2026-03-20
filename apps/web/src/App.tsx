import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Destination, ScreenState, RecordingState, SendState } from './types';
import { api } from './services/api';

import { ScreenSelect } from './components/ScreenSelect';
import { ScreenRecord } from './components/ScreenRecord';
import { ScreenReview } from './components/ScreenReview';
import { ScreenComplete } from './components/ScreenComplete';
import { TopBar } from './components/TopBar';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('select');
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [generatedText, setGeneratedText] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');

  // Screen 1 -> 2
  const handleSelectDestination = async (dest: Destination) => {
    setSelectedDestination(dest);
    try {
      const sid = await api.startVoiceSession(dest);
      setSessionId(sid);
      setCurrentScreen('record');
    } catch (error) {
      console.error("Failed to start session", error);
    }
  };

  // Screen 2 -> 3
  const handleRecordingComplete = async (audioBlob: Blob | null) => {
    if (!sessionId || !selectedDestination || !audioBlob) return;
    
    setCurrentScreen('review');
    setIsProcessing(true);
    setProcessingStep(1);
    
    try {
      await api.uploadVoiceBlob(sessionId, audioBlob, selectedDestination);
      
      const text = await api.getProcessingResult(sessionId, (step) => {
        setProcessingStep(step);
      });
      
      setGeneratedText(text);
    } catch (error) {
      console.error("Processing failed", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Screen 3 -> 4
  const handleSend = async () => {
    if (!sessionId || !selectedDestination) return;
    
    setSendState('sending');
    try {
      await api.sendStructuredOutput(sessionId, selectedDestination, generatedText);
      setSendState('success');
      setCurrentScreen('complete');
      
      // Auto reset after 3 seconds (1s animation + 2s stay)
      setTimeout(() => {
        handleReset();
      }, 3000);
    } catch (error) {
      console.error("Send failed", error);
      setSendState('error');
    }
  };

  const handleReset = () => {
    if (sessionId) {
      api.resetSession(sessionId);
    }
    setCurrentScreen('select');
    setSelectedDestination(null);
    setSessionId(null);
    setRecordingState('idle');
    setIsProcessing(false);
    setProcessingStep(0);
    setGeneratedText('');
    setSendState('idle');
  };

  return (
    <div className="min-h-screen bg-voxera-bg text-white flex flex-col items-center overflow-hidden relative selection:bg-voxera-accent/30">
      <TopBar />
      
      <main className="flex-1 w-full max-w-md flex flex-col relative px-6 pb-12 pt-24">
        <AnimatePresence mode="wait">
          {currentScreen === 'select' && (
            <ScreenSelect 
              key="select" 
              onSelect={handleSelectDestination} 
            />
          )}
          
          {currentScreen === 'record' && (
            <ScreenRecord 
              key="record" 
              recordingState={recordingState}
              setRecordingState={setRecordingState}
              onComplete={handleRecordingComplete} 
            />
          )}
          
          {currentScreen === 'review' && (
            <ScreenReview 
              key="review" 
              isProcessing={isProcessing}
              processingStep={processingStep}
              generatedText={generatedText}
              sendState={sendState}
              onSend={handleSend}
              onCancel={handleReset}
            />
          )}
          
          {currentScreen === 'complete' && (
            <ScreenComplete 
              key="complete" 
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
