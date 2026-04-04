import { useState } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  {
    title: 'Sleep Habits',
    icon: '🌙',
    fields: [
      { key: 'bedtime', label: 'What time do you usually go to bed?', type: 'select', options: [
        { value: 'before-10pm', label: 'Before 10 PM' },
        { value: '10pm-12am', label: '10 PM – 12 AM' },
        { value: '12am-2am', label: '12 AM – 2 AM' },
        { value: 'after-2am', label: 'After 2 AM' },
      ]},
      { key: 'wakeTime', label: 'What time do you usually wake up?', type: 'select', options: [
        { value: 'before-7am', label: 'Before 7 AM' },
        { value: '7am-9am', label: '7 AM – 9 AM' },
        { value: '9am-11am', label: '9 AM – 11 AM' },
        { value: 'after-11am', label: 'After 11 AM' },
      ]},
      { key: 'lightSleeper', label: 'Are you a light sleeper?', type: 'toggle' },
    ],
  },
  {
    title: 'Study Preferences',
    icon: '📚',
    fields: [
      { key: 'studyHours', label: 'Daily study hours?', type: 'select', options: [
        { value: '0-2', label: '0 – 2 hours' },
        { value: '2-4', label: '2 – 4 hours' },
        { value: '4-6', label: '4 – 6 hours' },
        { value: '6+', label: '6+ hours' },
      ]},
      { key: 'studyLocation', label: 'Where do you prefer to study?', type: 'select', options: [
        { value: 'room', label: 'In my room' },
        { value: 'library', label: 'In the library' },
        { value: 'mix', label: 'Mix of both' },
      ]},
      { key: 'noiseWhileStudy', label: 'Noise tolerance while studying?', type: 'select', options: [
        { value: 'silence', label: 'Complete silence' },
        { value: 'music', label: 'Background music is fine' },
        { value: 'doesnt-matter', label: 'Doesn\'t matter' },
      ]},
    ],
  },
  {
    title: 'Social Life',
    icon: '🎉',
    fields: [
      { key: 'guestsFrequency', label: 'How often do you have friends over?', type: 'select', options: [
        { value: 'rarely', label: 'Rarely' },
        { value: 'sometimes', label: 'Sometimes' },
        { value: 'often', label: 'Often' },
        { value: 'daily', label: 'Daily' },
      ]},
      { key: 'partyPerson', label: 'Do you enjoy parties/social events?', type: 'toggle' },
      { key: 'introExtro', label: 'Introvert ↔ Extrovert', type: 'slider', min: 1, max: 5 },
    ],
  },
];

export default function Survey() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    bedtime: '10pm-12am',
    wakeTime: '7am-9am',
    lightSleeper: false,
    studyHours: '2-4',
    studyLocation: 'mix',
    noiseWhileStudy: 'music',
    guestsFrequency: 'sometimes',
    partyPerson: false,
    introExtro: 3,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (key, value) => {
    setAnswers({ ...answers, [key]: value });
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/student/survey', answers);
      setResult(data);
    } catch (err) {
      console.error('Survey submit error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="page container flex items-center justify-center">
        <div className="glass-card-static text-center animate-slide-up" style={{ maxWidth: 480 }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-lg)' }}>✅</div>
          <h2 className="mb-md">Survey Complete!</h2>
          <p className="text-muted mb-xl">Your lifestyle vector has been calculated.</p>

          <div className="grid-3 mb-xl">
            <div className="stat-card">
              <div className="stat-value">{result.vector.sleep}</div>
              <div className="stat-label">🌙 Sleep</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-gold)' }}>{result.vector.study}</div>
              <div className="stat-label">📚 Study</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success-light)' }}>{result.vector.social}</div>
              <div className="stat-label">🎉 Social</div>
            </div>
          </div>

          <button className="btn btn-cardinal" onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentStep = STEPS[step];

  return (
    <div className="page container flex items-center justify-center">
      <div className="glass-card-static animate-slide-up" style={{ width: '100%', maxWidth: 560 }}>
        {/* Step Progress */}
        <div className="survey-steps">
          {STEPS.map((_, i) => (
            <div key={i} className={`survey-step ${i === step ? 'active' : i < step ? 'completed' : ''}`} />
          ))}
        </div>

        {/* Step Header */}
        <div className="text-center mb-xl">
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>{currentStep.icon}</div>
          <h2>{currentStep.title}</h2>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>Step {step + 1} of {STEPS.length}</p>
        </div>

        {/* Fields */}
        {currentStep.fields.map((field) => (
          <div key={field.key} className="form-group">
            <label className="form-label">{field.label}</label>

            {field.type === 'select' && (
              <select
                className="form-input"
                value={answers[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
              >
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}

            {field.type === 'toggle' && (
              <div
                className="flex items-center gap-md"
                onClick={() => handleChange(field.key, !answers[field.key])}
                style={{ cursor: 'pointer' }}
              >
                <div style={{
                  width: 48, height: 26, borderRadius: 'var(--radius-full)',
                  background: answers[field.key]
                    ? 'linear-gradient(135deg, var(--cardinal) 0%, var(--cardinal-light) 100%)'
                    : 'rgba(155,154,151,0.2)',
                  padding: 3, transition: 'all var(--transition-base)', cursor: 'pointer',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'white',
                    transition: 'all var(--transition-base)',
                    transform: answers[field.key] ? 'translateX(22px)' : 'translateX(0)',
                  }} />
                </div>
                <span style={{ fontSize: '0.9rem' }}>{answers[field.key] ? 'Yes' : 'No'}</span>
              </div>
            )}

            {field.type === 'slider' && (
              <div className="slider-container">
                <input
                  type="range"
                  className="slider"
                  min={field.min}
                  max={field.max}
                  value={answers[field.key]}
                  onChange={(e) => handleChange(field.key, parseInt(e.target.value))}
                />
                <div className="slider-labels">
                  <span>Introvert</span>
                  <span>{answers[field.key]}/5</span>
                  <span>Extrovert</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Navigation */}
        <div className="flex justify-between mt-xl">
          <button
            className="btn btn-ghost"
            onClick={handleBack}
            disabled={step === 0}
          >
            ← Back
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-cardinal" onClick={handleNext}>
              Next →
            </button>
          ) : (
            <button className="btn btn-gold" onClick={handleSubmit} disabled={loading}>
              {loading ? <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'Submit Survey'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
