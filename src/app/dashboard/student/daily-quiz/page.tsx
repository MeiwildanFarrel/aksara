'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/client'
import StudentNav from '../components/StudentNav'
import { AlertCircle, Heart, Flag, Ban, Lock, Sparkles, Send } from 'lucide-react'

function DailyQuizInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isReviewMode = searchParams.get('review') === '1'
  const [user, setUser] = useState<any | null>(null)
  const [topic, setTopic] = useState('Sains Kognitif')
  const [isChecking, setIsChecking] = useState(true)

  // Quiz States
  const [quizState, setQuizState] = useState<'loading' | 'active' | 'finished'>('loading')
  const [questions, setQuestions] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [questionResults, setQuestionResults] = useState<boolean[]>([])
  
  // Lifeline & RAG AI States
  const [strikesRemaining, setStrikesRemaining] = useState(3)
  const [consecutiveErrors, setConsecutiveErrors] = useState(0)
  const [hintUnlocked, setHintUnlocked] = useState(false)
  const [isAiTutorVisible, setIsAiTutorVisible] = useState(false)

  // RAG AI Chat States
  const [chatMessages, setChatMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const generateQuestions = async (currentTopic: string) => {
    setQuizState('loading')
    // Simulate AI Generation time
    await new Promise(r => setTimeout(r, 1200))
    const newQs = Array(5).fill(null).map((_, i) => {
      const ans = Math.floor(Math.random() * 4)
      return {
        variant: `Variant Question ${String.fromCharCode(65 + (3 - strikesRemaining))}-${i+1}`,
        question: `Berdasarkan konsep utama pada topik "${currentTopic}", manakah pendekatan atau penjelasan berikut yang paling akurat untuk diterapkan pada studi kasus intervensi kognitif ke-${i+1}?`,
        options: [
          `Menggunakan metode observasi langsung tanpa kontrol.`,
          `Menerapkan metrik terstruktur untuk validasi data.`,
          `Melakukan analisis korelasi silang antar variabel.`,
          `Mengandalkan pendekatan heuristik dari rekam jejak.`
        ],
        answerIndex: ans,
        explanation: `Sistem RAG mendeteksi bahwa pilihan yang paling sesuai menurut pedoman literatur "${currentTopic}" adalah opsi ${String.fromCharCode(65 + ans)}. Pendekatan ini memastikan akurasi data dengan mengisolasi variabel perancu dalam konteks studi kasus tersebut.`
      }
    })
    setQuestions(newQs)
    setCurrentIndex(0)
    setSelectedOption(null)
    setIsAnswered(false)
    setIsCorrect(null)
    setCorrectCount(0)
    setQuestionResults([])
    setConsecutiveErrors(0)
    setHintUnlocked(false)
    setIsAiTutorVisible(false)
    setQuizState('active')
  }

  useEffect(() => {
    async function loadData() {
      const res = await fetch('/api/user/me')
      if (res.ok) setUser(await res.json())
      
      const saved = localStorage.getItem('student_sessions')
      let initialTopic = 'Sains Kognitif'
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.length > 0) {
          const dayOfYear = Math.floor((new Date().getTime() - new Date().getTimezoneOffset() * 60000) / 86400000)
          initialTopic = parsed[dayOfYear % parsed.length].title
          setTopic(initialTopic)
        }
      }
      setIsChecking(false)
      generateQuestions(initialTopic)

      // Store active session_id for RAG
      const savedSessions = localStorage.getItem('student_sessions')
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions)
        if (parsedSessions.length > 0) setActiveSessionId(parsedSessions[0].id || '')
      }
    }
    loadData()
  }, [])

  // --- Review Mode: show finished results from localStorage ---
  if (isReviewMode) {
    const savedRaw = typeof window !== 'undefined' ? localStorage.getItem('daily_quiz_result') : null
    const saved = savedRaw ? JSON.parse(savedRaw) : null
    const reviewTopic = saved?.topic || topic
    const reviewResults: boolean[] = saved?.results || []
    const reviewMmr: number = saved?.mmrGained || 0

    return (
      <div className="min-h-screen bg-[#FFF9F2] flex flex-col">
        <StudentNav active="dashboard" user={user} />
        <main className="flex-1 w-full max-w-[780px] mx-auto p-6 md:p-10 flex flex-col">
          <div className="mb-8">
            <h1 className="font-heading text-[36px] font-bold text-[#2C1A08] leading-tight mb-1">Review Jawaban</h1>
            <p className="font-sans text-[15px] font-semibold text-[#8C7A67]">Topik: <span className="text-[#C8922A]">{reviewTopic}</span></p>
          </div>

          <div className="bg-[#FDFBF7] rounded-2xl border border-[#E8DCCB] p-6 mb-8 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#FDE2A6] flex items-center justify-center text-[#C8922A] border-4 border-white shadow">
                <Sparkles size={24} />
              </div>
              <div>
                <p className="font-sans text-[12px] font-bold text-[#A6998A] uppercase tracking-wider">Total MMR Diperoleh</p>
                <p className="font-heading text-[28px] font-bold text-[#1A8B49]">+{reviewMmr} MMR</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-sans text-[12px] font-bold text-[#A6998A] uppercase tracking-wider">Jawaban Benar</p>
              <p className="font-heading text-[28px] font-bold text-[#2C1A08]">{reviewResults.filter(Boolean).length} / 5</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 mb-10">
            {reviewResults.map((correct, i) => (
              <div key={i} className={`flex items-center gap-4 rounded-2xl p-5 border-2 ${correct ? 'bg-white border-[#1A8B49]' : 'bg-[#FDF0F0] border-[#E8B4B8]'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  correct ? 'bg-[#E8F8EF] text-[#1A8B49]' : 'bg-[#FDEDEC] text-[#C0392B]'
                }`}>
                  {correct
                    ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                </div>
                <div>
                  <p className={`font-sans text-[14px] font-bold ${correct ? 'text-[#1A8B49]' : 'text-[#C0392B]'}`}>
                    Soal {i + 1}: {correct ? 'Benar' : 'Salah'}
                  </p>
                  {!correct && (
                    <p className="font-sans text-[13px] text-[#8C7A67] mt-0.5">
                      Sistem RAG mendeteksi bahwa jawaban pada soal ini perlu diperkuat dengan pemahaman konteks variabel independen dalam topik "{reviewTopic}".
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => router.push('/dashboard/student')} className="w-full bg-[#825C17] hover:bg-[#684911] text-white py-4 rounded-[14px] font-sans font-bold shadow-md transition-colors text-[15px]">
            Kembali ke Dashboard
          </button>
        </main>
      </div>
    )
  }

  const handleSubmit = () => {
    if (selectedOption === null || isAnswered) return
    const q = questions[currentIndex]
    const correct = selectedOption === q.answerIndex
    setIsAnswered(true)
    setIsCorrect(correct)
    
    if (correct) {
      setCorrectCount(prev => prev + 1)
      setConsecutiveErrors(0)
    } else {
      const newErrors = consecutiveErrors + 1
      setConsecutiveErrors(newErrors)
      if (newErrors >= 2) {
        setHintUnlocked(true)
      }
    }
  }

  const handleNext = () => {
    const newResults = [...questionResults, isCorrect || false]
    setQuestionResults(newResults)
    if (currentIndex < 4) {
      setCurrentIndex(prev => prev + 1)
      setSelectedOption(null)
      setIsAnswered(false)
      setIsCorrect(null)
    } else {
      setQuizState('finished')
      const today = new Date().toISOString().split('T')[0]
      localStorage.setItem('daily_quiz_result', JSON.stringify({
         date: today,
         topic: topic,
         results: newResults,
         mmrGained: correctCount * 3
      }))
    }
  }

  const handleSkip = () => {
    if (isAnswered) return
    setIsAnswered(true)
    setIsCorrect(false)
    const newErrors = consecutiveErrors + 1
    setConsecutiveErrors(newErrors)
    if (newErrors >= 2) setHintUnlocked(true)
  }

  const handleRetry = () => {
    if (strikesRemaining > 0) {
      setStrikesRemaining(prev => prev - 1)
      generateQuestions(topic)
    }
  }

  const handleOpenAiTutor = (contextQuestion?: string) => {
    setIsAiTutorVisible(true)
    if (chatMessages.length === 0) {
      const greeting = contextQuestion
        ? `Saya perhatikan Anda kesulitan. Pada materi **${topic}**, konsep yang relevan:

"Setiap pendekatan harus disesuaikan dengan konteks dan batasan variabel kontrol yang ada, bukan hanya berfokus pada hasil akhir."

Apakah ada yang ingin Anda tanyakan lebih lanjut?`
        : `Halo! Saya RAG AI Tutor untuk topik **${topic}**. Saya siap membantu menjawab pertanyaan Anda seputar materi ini.`
      setChatMessages([{ role: 'ai', text: greeting }])
    }
  }

  const sendMessage = async () => {
    const trimmed = chatInput.trim()
    if (!trimmed || isSending) return
    setChatInput('')
    setIsSending(true)
    setChatMessages(prev => [...prev, { role: 'user', text: trimmed }])
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const res = await fetch('/api/ael/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          session_id: activeSessionId || 'daily-quiz',
          mode: 'eli5'
        })
      })
      const data = await res.json()
      const aiReply = data.answer || 'Maaf, saya tidak dapat merespons saat ini. Coba ulangi pertanyaan Anda.'
      setChatMessages(prev => [...prev, { role: 'ai', text: aiReply }])
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Koneksi ke AI Tutor gagal. Pastikan Anda terhubung ke internet.' }])
    } finally {
      setIsSending(false)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  if (isChecking || quizState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0] flex-col gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
        <p className="font-sans text-[14px] font-bold text-[#8C7A67] animate-pulse">RAG AI sedang merombak dan menyiapkan kuis...</p>
      </div>
    )
  }

  const currentQ = questions[currentIndex]

  return (
    <div className="min-h-screen bg-[#FFF9F2] flex flex-col">
      <StudentNav active="dashboard" user={user} />

      <main className="flex-1 w-full max-w-[1200px] mx-auto p-6 md:p-10 flex flex-col">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#FDEDEC] text-[#C0392B] px-3 py-1 rounded-full text-[12px] font-bold font-sans mb-4 shadow-sm border border-[#FAD2D0]">
              <AlertCircle size={14} />
              MMR Penalty for Skipping: -50% Task Weight
            </div>
            <h1 className="font-heading text-[38px] md:text-[42px] font-bold text-[#2C1A08] leading-tight mb-1">
              Daily Quiz
            </h1>
            <p className="font-sans text-[15px] font-semibold text-[#8C7A67]">
              Topic: <span className="text-[#C8922A]">{topic}</span>
            </p>
          </div>

          <div className="bg-[#FDEDEC] rounded-2xl border border-[#FAD2D0] px-6 py-4 flex flex-col items-center min-w-[180px] shadow-sm">
            <span className="text-[10px] font-bold font-sans text-[#A93226] uppercase tracking-widest mb-2">3-Strike Lifelines</span>
            <div className="flex items-center gap-2 mb-1.5">
              {[1, 2, 3].map((strike) => (
                <Heart key={strike} className={`w-6 h-6 ${strike <= strikesRemaining ? 'text-[#C0392B] fill-[#C0392B]' : 'text-[#E8DCCB] fill-transparent stroke-2'}`} />
              ))}
            </div>
            <span className="text-[13px] font-bold font-sans text-[#C0392B]">{strikesRemaining} Strikes Remaining</span>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Left Column: Quiz */}
          <div className={`flex-1 w-full flex flex-col gap-6 transition-all duration-500 ${!isAiTutorVisible ? 'max-w-4xl mx-auto' : ''}`}>
            
            {quizState === 'finished' ? (
              <div className="bg-white rounded-[24px] p-12 border border-[#E8DCCB] shadow-sm text-center flex flex-col items-center animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-[#FDE2A6] rounded-full flex items-center justify-center text-[#C8922A] mb-6 shadow-inner border-[4px] border-[#FFF3E0]">
                  <Sparkles size={40} />
                </div>
                <h2 className="font-heading text-[36px] font-bold text-[#2C1A08] mb-2">Sesi Kuis Selesai!</h2>
                <p className="font-sans text-[16px] text-[#8C7A67] mb-6 max-w-md">Anda berhasil menjawab <strong className="text-[#5B4E41]">{correctCount} dari 5</strong> pertanyaan dengan benar.</p>
                
                <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-6 w-full max-w-[280px] mx-auto mb-10 flex flex-col items-center shadow-sm">
                   <span className="text-[11px] font-bold font-sans text-[#A6998A] uppercase tracking-wider mb-2">Total MMR Diperoleh</span>
                   <div className="flex items-center gap-2">
                     <span className="text-[36px] font-heading font-bold text-[#1A8B49] animate-in zoom-in duration-500 delay-300">+{correctCount * 3}</span>
                     <span className="text-[16px] font-sans font-bold text-[#1A8B49] self-end mb-2">MMR</span>
                   </div>
                   <p className="text-[12px] font-sans text-[#8C7A67] mt-2 text-center animate-pulse">Sistem sedang mengakumulasi skor ke profil Anda...</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => router.push('/dashboard/student')} className="px-8 py-3.5 border-2 border-[#E8DCCB] text-[#5C3D1A] rounded-[14px] font-bold font-sans hover:bg-[#FDFBF7] transition-colors">
                    Kembali ke Dashboard
                  </button>
                  {strikesRemaining > 0 && (
                    <button onClick={handleRetry} className="bg-[#825C17] hover:bg-[#684911] text-white px-8 py-3.5 rounded-[14px] font-sans font-bold shadow-md transition-colors flex items-center justify-center gap-2">
                      <Heart size={16} className="fill-white" />
                      Gunakan Lifeline ({strikesRemaining} sisa)
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Question Card */}
                <div className="bg-white rounded-[24px] p-8 border border-[#E8DCCB] shadow-sm relative animate-in slide-in-from-right-4 duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <span className="bg-[#2C1A08] text-white px-4 py-1.5 rounded-full text-[12px] font-bold font-sans">
                      {currentQ.variant}
                    </span>
                    <div className="flex gap-2">
                      {hintUnlocked && (
                        <button 
                          onClick={() => handleOpenAiTutor(currentQ.question)}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold font-sans transition-colors ${isAiTutorVisible ? 'bg-[#C8922A] text-white shadow-inner' : 'bg-[#F9E298] text-[#7A5200] hover:bg-[#F2D078] shadow-sm animate-pulse'}`}
                        >
                          <Sparkles size={14} />
                          Hint (ELI5)
                        </button>
                      )}
                      <button className="flex items-center gap-1.5 bg-white border border-[#E8DCCB] text-[#8C7A67] px-4 py-1.5 rounded-full text-[12px] font-bold font-sans hover:bg-[#F8F3EC] transition-colors">
                        <Flag size={14} />
                        Flag
                      </button>
                    </div>
                  </div>

                  <p className="font-sans text-[17px] text-[#2C1A08] leading-relaxed mb-8 font-medium">
                    {currentQ.question}
                  </p>

                  <div className="flex flex-col gap-3 mb-10">
                    {currentQ.options.map((opt: string, idx: number) => {
                      const isSelected = selectedOption === idx
                      const isCorrectOption = idx === currentQ.answerIndex
                      
                      let style = "bg-white border-[#E8DCCB] text-[#5C3D1A] hover:border-[#C8922A]/50"
                      let circleStyle = "border-[#D8CCBC]"
                      let innerCircle = null
                      
                      if (isAnswered) {
                        if (isCorrectOption) {
                          style = "bg-[#FDFBF7] border-[#C8922A] text-[#2C1A08] shadow-[0_0_0_1px_#C8922A]"
                          circleStyle = "border-[#C8922A]"
                          innerCircle = <div className="w-2.5 h-2.5 rounded-full bg-[#C8922A]"></div>
                        } else if (isSelected) {
                          style = "bg-[#FDEDEC] border-[#C0392B] text-[#A93226] shadow-[0_0_0_1px_#C0392B]"
                          circleStyle = "border-[#C0392B] bg-[#FDEDEC]"
                          innerCircle = <svg className="w-4 h-4 text-[#C0392B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        } else {
                          style = "bg-white border-[#E8DCCB] text-[#A6998A] opacity-60 cursor-default"
                        }
                      } else if (isSelected) {
                        style = "bg-[#FDFBF7] border-[#C8922A] text-[#2C1A08]"
                        circleStyle = "border-[#C8922A]"
                        innerCircle = <div className="w-2.5 h-2.5 rounded-full bg-[#C8922A]"></div>
                      }

                      return (
                        <div 
                          key={idx} 
                          onClick={() => !isAnswered && setSelectedOption(idx)}
                          className={`flex items-center gap-4 border-2 rounded-2xl p-4 transition-all ${isAnswered ? '' : 'cursor-pointer'} relative overflow-hidden ${style}`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${circleStyle}`}>
                            {innerCircle}
                          </div>
                          <span className={`font-sans text-[14.5px] ${isSelected || (isAnswered && isCorrectOption) ? 'font-semibold' : ''}`}>{opt}</span>
                        </div>
                      )
                    })}
                  </div>

                  {isAnswered && !isCorrect && (
                    <div className="mb-8 p-5 bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm">
                      <div className="w-9 h-9 rounded-full bg-[#FDE2A6] flex items-center justify-center text-[#C8922A] shrink-0 border-[2px] border-white shadow-sm">
                        <Sparkles size={16} />
                      </div>
                      <div className="pt-0.5">
                        <h4 className="font-sans text-[12px] font-bold text-[#A6998A] uppercase tracking-wider mb-1.5">RAG AI Explanation</h4>
                        <p className="font-sans text-[14.5px] text-[#5B4E41] leading-relaxed">
                          <strong className="text-[#C0392B] mr-1">{selectedOption === null ? 'Dilewati.' : 'Kurang tepat.'}</strong> 
                          {currentQ.explanation}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-6 border-t border-[#F0E8DC]">
                    <button 
                      onClick={handleSkip}
                      disabled={isAnswered}
                      className={`flex items-center gap-2 font-sans text-[13.5px] font-bold transition-colors ${isAnswered ? 'text-[#D8CCBC] cursor-not-allowed opacity-50' : 'text-[#C0392B] hover:text-[#A93226]'}`}
                    >
                      <Ban size={16} />
                      Skip + MMR Penalty
                    </button>
                    <div className="flex gap-3">
                      {isAnswered ? (
                        <button onClick={handleNext} className="bg-[#825C17] hover:bg-[#684911] text-white px-8 py-3.5 rounded-xl font-sans font-bold text-[14px] shadow-md transition-all flex items-center gap-2 hover:-translate-y-0.5">
                          {currentIndex < 4 ? 'Lanjut ke Soal Berikutnya' : 'Selesaikan Kuis'}
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      ) : (
                        <>
                          <button disabled className="flex items-center gap-2 bg-[#F6F1EA] text-[#A6998A] px-6 py-3.5 rounded-xl font-sans font-bold text-[14px] cursor-not-allowed border border-[#E8DCCB]">
                            <Lock size={16} />
                            Lanjut
                          </button>
                          <button 
                            onClick={handleSubmit}
                            disabled={selectedOption === null}
                            className={`text-white px-8 py-3.5 rounded-xl font-sans font-bold text-[14px] shadow-md transition-all ${selectedOption === null ? 'bg-[#D8CCBC] cursor-not-allowed' : 'bg-[#825C17] hover:bg-[#684911] hover:-translate-y-0.5'}`}
                          >
                            Submit Answer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Persistence Bar */}
                <div className="bg-[#FAEFE2] rounded-2xl p-6 border border-[#EFDECD] shadow-sm">
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-[11px] font-bold font-sans text-[#8C7A67] uppercase tracking-wider">Current Quiz Persistence</span>
                    <span className="text-[13px] font-bold font-sans text-[#825C17]">{Math.round((correctCount / 5) * 100)}% Correctness</span>
                  </div>
                  <div className="w-full bg-[#E8DCCB] h-3 rounded-full overflow-hidden">
                    <div className="bg-[#825C17] h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${(correctCount / 5) * 100}%` }}></div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Column: RAG AI Tutor */}
          {isAiTutorVisible && (
            <div className="w-full lg:w-[380px] bg-white rounded-[24px] border border-[#E8DCCB] shadow-lg flex flex-col overflow-hidden h-[640px] animate-in slide-in-from-right-8 duration-500">
              {/* Header */}
              <div className="bg-[#2C1A08] p-5 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#F9E298] rounded-xl flex items-center justify-center text-[#7A5200]">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-heading text-[16px] font-bold text-white leading-tight">RAG AI Tutor</h3>
                  <p className="font-sans text-[9px] text-[#A6998A] tracking-wider uppercase mt-0.5">Membantu: Kuis {topic}</p>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 p-5 overflow-y-auto bg-[#FDFBF7] flex flex-col gap-5">
                
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end self-end max-w-[85%]' : 'items-start max-w-[95%]'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`rounded-2xl p-4 shadow-sm ${
                      msg.role === 'ai'
                        ? 'bg-white border border-[#E8DCCB] rounded-tl-sm'
                        : 'bg-[#FDE2A6] text-[#2C1A08] rounded-tr-sm'
                    }`}>
                      <p className="font-sans text-[13.5px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                    <span className="text-[9px] font-bold font-sans text-[#A6998A] uppercase tracking-wider px-1">
                      {msg.role === 'ai' ? 'RAG AI Tutor' : 'Anda'}
                    </span>
                  </div>
                ))}

                {isSending && (
                  <div className="flex items-start gap-2 max-w-[80%] animate-in fade-in duration-200">
                    <div className="bg-white border border-[#E8DCCB] rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-[#C8922A] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-[#C8922A] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-[#C8922A] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="font-sans text-[12px] text-[#A6998A]">AI sedang mengetik...</span>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-[#E8DCCB]">
                <div className="relative flex items-center">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={isSending ? 'AI sedang merespons...' : 'Tanya ke AI Tutor...'}
                    disabled={isSending}
                    className="w-full bg-[#FDFBF7] border border-[#E8DCCB] rounded-full py-3.5 pl-4 pr-12 font-sans text-[13px] text-[#2C1A08] outline-none focus:border-[#C8922A] focus:ring-1 focus:ring-[#C8922A] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button 
                    onClick={sendMessage}
                    disabled={!chatInput.trim() || isSending}
                    className="absolute right-2 w-9 h-9 bg-[#825C17] hover:bg-[#684911] disabled:bg-[#D8CCBC] disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors shadow-sm">
                    <Send size={14} className="ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

export default function DailyQuizPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FBF7F0] flex-col gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#C8922A] border-t-transparent" />
        <p className="font-sans text-[14px] font-bold text-[#8C7A67] animate-pulse">Memuat kuis...</p>
      </div>
    }>
      <DailyQuizInner />
    </Suspense>
  )
}
