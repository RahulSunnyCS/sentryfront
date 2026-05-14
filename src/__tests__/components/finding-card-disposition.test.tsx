import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FindingCard } from '@/components/finding-card';
import type { Finding } from '@/types';

const finding: Finding = {
  id: 'f1',
  module: 'P1-08',
  category: 'Headers',
  severity: 'HIGH',
  title: 'Mixed content',
  location: 'https://example.com',
  evidence: 'evidence text',
  explanation: 'explanation',
  impact: 'impact',
  fixManual: ['step 1'],
  fixAiPrompt: 'prompt',
  currentDisposition: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  (global.fetch as any) = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
});

function renderCard(props: Partial<React.ComponentProps<typeof FindingCard>> = {}) {
  return render(
    <FindingCard
      finding={finding}
      isExpanded={true}
      onToggle={() => {}}
      cardStyle="elevated"
      scanId="scan-1"
      authed={true}
      {...props}
    />,
  );
}

describe('FindingCard disposition row', () => {
  it('renders four action buttons in the expanded body', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'Helpful' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'False positive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Fix didn't help" })).toBeInTheDocument();
  });

  it('optimistically marks the clicked button selected and POSTs', async () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'False positive' }));
    expect(screen.getByRole('button', { name: 'False positive' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/scans/scan-1/findings/f1/disposition',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('reverts on fetch failure and surfaces an error', async () => {
    (global.fetch as any) = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server boom' }),
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'False positive' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'False positive' }),
      ).toHaveAttribute('aria-pressed', 'false'),
    );
    expect(screen.getByText(/server boom/)).toBeInTheDocument();
  });

  it('disables the buttons when the user is not signed in', () => {
    renderCard({ authed: false });
    for (const label of ['Helpful', 'Dismiss', 'False positive', "Fix didn't help"]) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    }
    expect(screen.getByText(/Sign in to flag/i)).toBeInTheDocument();
  });
});
