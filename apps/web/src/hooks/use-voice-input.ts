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

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { onResult, onInterimResult, language = 'es-ES', continuous = true } = options
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    if (!isSupported) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.lang = language
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
        onResult?.(finalTranscript)
      }
      if (interimTranscript) {
        onInterimResult?.(interimTranscript)
      }
    }

    recognition.onerror = (event) => {
      console.error('[Voice] Error:', event.error)
      if (event.error !== 'no-speech') {
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening (continuous mode)
      if (recognitionRef.current && isListening) {
        try {
          recognition.start()
        } catch {
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
  }, [isSupported, language, continuous, onResult, onInterimResult, isListening])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    try {
      recognitionRef.current.start()
      setIsListening(true)
      setTranscript('')
    } catch {
      // Already started
    }
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    setIsListening(false)
    try {
      recognitionRef.current.stop()
    } catch { /* ignore */ }
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    toggleListening,
  }
}
