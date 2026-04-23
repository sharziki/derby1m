/**
 * Regression test for Bug 1: ProbabilityChart must render real percentages
 * (not "—" or "0.0%") when results are present.
 *
 * The fixture is the actual /api/simulate response shape (snake_case fields)
 * generated from the calibrated model with seed=42 — so the asserted strings
 * are deterministic and tied to the same constants the production sim uses.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProbabilityChart, AnimatedPct } from '@/components/probability-chart';
import type { Horse, HorseResult } from '@/lib/types';
import { validateSimResponse } from '@/lib/schema';
import fixture from './fixtures/sim-response.json';
import field from '../data/field.example.json';

describe('ProbabilityChart', () => {
  it('renders the literal P(win) percentages from a real API response', () => {
    // Validate that the fixture matches the production response shape.
    const validated = validateSimResponse(fixture);
    expect(validated.results.length).toBe(10);

    render(
      <ProbabilityChart
        field={field.horses as Horse[]}
        results={validated.results as HorseResult[]}
        beliefs={{}}
        onBeliefChange={() => {}}
        loading={false}
      />,
    );

    // Calibrated model with seed=42 produces deterministic strings.
    expect(screen.getByText(/Renegade/)).toBeInTheDocument();
    expect(screen.getByText('16.7%')).toBeInTheDocument();

    expect(screen.getByText(/Commandment/)).toBeInTheDocument();
    expect(screen.getByText('9.7%')).toBeInTheDocument();

    // Further Ado: 21.3% — the model favorite.
    expect(screen.getByText(/Further Ado/)).toBeInTheDocument();
    expect(screen.getByText('21.3%')).toBeInTheDocument();

    // Crucially: NOTHING should render as "0.0%" — that was the loading bug.
    expect(screen.queryByText(/^0\.0%$/)).not.toBeInTheDocument();

    // Crucially: nothing should render as the em-dash placeholder.
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('shows the em-dash placeholder when results are null', () => {
    render(
      <ProbabilityChart
        field={field.horses as Horse[]}
        results={null}
        beliefs={{}}
        loading={true}
      />,
    );
    // 10 horses → 10 em-dashes in the P(win) column.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(10);
  });
});

describe('AnimatedPct', () => {
  it('formats the value as a percentage string with one decimal', () => {
    render(<AnimatedPct value={0.4377} />);
    expect(screen.getByText('43.8%')).toBeInTheDocument();
  });

  it('handles zero without rendering as the placeholder', () => {
    render(<AnimatedPct value={0} />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });
});
