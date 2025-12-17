import React, { useState } from 'react';

interface MortgageInput {
  principal: number;
  interestRate: number;
  years: number;
}

interface MortgageResult {
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
}

function calculateMortgage({ principal, interestRate, years }: MortgageInput): MortgageResult {
  const n = years * 12;
  const r = interestRate / 100 / 12;
  const monthlyPayment = r === 0
    ? principal / n
    : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayment = monthlyPayment * n;
  const totalInterest = totalPayment - principal;
  return { monthlyPayment, totalPayment, totalInterest };
}

const MortgageAIPrototype: React.FC = () => {
  const [input, setInput] = useState<MortgageInput>({ principal: 300000, interestRate: 5, years: 30 });
  const [result, setResult] = useState<MortgageResult | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput({ ...input, [e.target.name]: parseFloat(e.target.value) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(calculateMortgage(input));
    setSubmitted(false);
  };

  const handleFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
      <h2>Mortgage AI Prototype</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Principal ($):
          <input type="number" name="principal" value={input.principal} onChange={handleChange} min={0} required />
        </label>
        <br />
        <label>
          Interest Rate (%):
          <input type="number" name="interestRate" value={input.interestRate} onChange={handleChange} min={0} step={0.01} required />
        </label>
        <br />
        <label>
          Years:
          <input type="number" name="years" value={input.years} onChange={handleChange} min={1} required />
        </label>
        <br />
        <button type="submit">Calculate</button>
      </form>
      {result && (
        <div style={{ marginTop: 24 }}>
          <h3>Results</h3>
          <p>Monthly Payment: <b>${result.monthlyPayment.toFixed(2)}</b></p>
          <p>Total Payment: <b>${result.totalPayment.toFixed(2)}</b></p>
          <p>Total Interest: <b>${result.totalInterest.toFixed(2)}</b></p>
          <form onSubmit={handleFeedback} style={{ marginTop: 16 }}>
            <label>
              Your feedback:
              <input type="text" value={feedback} onChange={e => setFeedback(e.target.value)} required disabled={submitted} />
            </label>
            <button type="submit" disabled={submitted}>Submit Feedback</button>
          </form>
          {submitted && <p style={{ color: 'green' }}>Thank you for your feedback!</p>}
        </div>
      )}
    </div>
  );
};

export default MortgageAIPrototype;
