'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseVoiceInputOptions {
  onResult?: (transcript: string) => void
  onInterimResult?: (transcript: string) => void
  language?: string
  continuous?: boolean
}

interface UseVoiceInputReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
}

// Detect browser language, fallback to navigator.language
function getBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return 'en-US'
  return navigator.language || 'en-US'
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { onResult, onInterimResult, language, continuous = true } = options
  const resolvedLanguage = language || getBrowserLanguage()
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isListeningRef = useRef(false) // Avoids stale closure
  const onResultRef = useRef(onResult)
  const onInterimRef = useRef(onInterimResult)
  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // Keep refs in sync
  onResultRef.current = onResult
  onInterimRef.current = onInterimResult

  // Create recognition once, not on every state change
  useEffect(() => {
    if (!isSupported) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.lang = resolvedLanguage
    recognition.maxAlternatives = 1

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalTranscript += result[0].transcript
        } else {
          interimTranscript += result[0].transcript
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript)
        onResultRef.current?.(finalTranscript)
      }
      if (interimTranscript) {
        onInterimRef.current?.(interimTranscript)
      }
    }

    recognition.onerror = (event) => {
      console.error('[Voice] Error:', event.error)
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        isListeningRef.current = false
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening (continuous mode)
      if (isListeningRef.current) {
        try {
          recognition.start()
        } catch {
          isListeningRef.current = false
          setIsListening(false)
        }
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition

    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try { recognition.stop() } catch { /* ignore */ }
      recognitionRef.current = null
    }
  // Only recreate when these fundamentals change, NOT on isListening
  }, [isSupported, resolvedLanguage, continuous])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    try {
      recognitionRef.current.start()
      isListeningRef.current = true
      setIsListening(true)
      setTranscript('')
    } catch {
      // Already started
    }
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    isListeningRef.current = false
    setIsListening(false)
    try {
      recognitionRef.current.stop()
    } catch { /* ignore */ }
  }, [])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      startListening()
    }
  }, [startListening, stopListening])

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    toggleListening,
  }
}
