import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the storefront shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /选择套餐/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /立即购买/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /客服引导/ })).toBeInTheDocument();
  });
});
