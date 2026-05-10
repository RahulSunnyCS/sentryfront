/**
 * Mock Accessibility Data Generator
 * Creates realistic WCAG 2.2 violations for demo purposes
 */

interface MockAudit {
  id: string;
  title: string;
  description: string;
  score: number;
  displayValue?: string;
  type?: string;
  items?: unknown[];
}

export function generateMockAccessibilityViolations(): MockAudit[] {
  return [
    // Color contrast violations
    {
      id: 'color-contrast',
      title: 'Background and foreground colors do not have a sufficient contrast ratio',
      description: 'Low-contrast text is difficult or impossible for many users to read. WCAG 2.2 Level AA requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text.',
      score: 0.67,
      displayValue: '8 elements',
      type: 'table',
      items: [
        {
          node: {
            selector: '.hero-text',
            snippet: '<span class="hero-text">Welcome</span>',
          },
        },
        {
          node: {
            selector: '.subtitle',
            snippet: '<p class="subtitle">Get started today</p>',
          },
        },
        {
          node: {
            selector: '.footer-link',
            snippet: '<a class="footer-link">Privacy</a>',
          },
        },
      ],
    },
    // Image alt text
    {
      id: 'image-alt',
      title: 'Image elements do not have [alt] attributes',
      description: 'Informative elements should aim for short, descriptive alternate text. Decorative elements can be ignored with an empty alt attribute.',
      score: 0,
      displayValue: '5 images',
      type: 'table',
      items: [
        {
          node: {
            selector: 'img.hero-banner',
            snippet: '<img src="/hero.jpg" class="hero-banner">',
          },
        },
        {
          node: {
            selector: 'img.product-thumbnail',
            snippet: '<img src="/product-1.jpg">',
          },
        },
      ],
    },
    // Form labels
    {
      id: 'label',
      title: 'Form elements do not have associated labels',
      description: 'Labels ensure that form controls are announced properly by assistive technologies like screen readers.',
      score: 0,
      displayValue: '3 elements',
      type: 'table',
      items: [
        {
          node: {
            selector: 'input#email',
            snippet: '<input type="email" id="email" placeholder="Email">',
          },
        },
        {
          node: {
            selector: 'input#password',
            snippet: '<input type="password" placeholder="Password">',
          },
        },
      ],
    },
    // Heading order
    {
      id: 'heading-order',
      title: 'Heading elements are not in a sequentially-descending order',
      description: 'Properly ordered headings that do not skip levels convey the semantic structure of the page, making it easier to navigate and understand.',
      score: 0,
      displayValue: '2 issues',
      type: 'table',
      items: [
        {
          node: {
            selector: 'h4.section-title',
            snippet: '<h4>Features</h4>',
          },
        },
      ],
    },
    // Button names
    {
      id: 'button-name',
      title: 'Buttons do not have an accessible name',
      description: 'When a button doesn\'t have an accessible name, screen readers announce it as "button", making it unusable for users who rely on screen readers.',
      score: 0.5,
      displayValue: '4 buttons',
      type: 'table',
      items: [
        {
          node: {
            selector: 'button.icon-only',
            snippet: '<button class="icon-only"><svg>...</svg></button>',
          },
        },
        {
          node: {
            selector: 'button.menu-toggle',
            snippet: '<button class="menu-toggle">☰</button>',
          },
        },
      ],
    },
  ];
}

export function generateMockAccessibilityMetrics() {
  return {
    accessibilityScore: 72, // C grade
    accessibilityGrade: 'C',
    violations: generateMockAccessibilityViolations(),
  };
}

export function generateMockAccessibilityFindings() {
  return [
    {
      id: 'mock-1',
      module: 'P3-01',
      category: 'Accessibility',
      severity: 'HIGH' as const,
      title: 'Color contrast issues detected (8 elements)',
      location: 'WCAG 1.4.3 - Contrast (Minimum)',
      evidence: '8 elements with insufficient color contrast:\n1. .hero-text - <span class="hero-text">Welcome</span>\n2. .subtitle - <p class="subtitle">Get started today</p>\n3. .footer-link - <a class="footer-link">Privacy</a>\n...and 5 more elements',
      explanation: 'Text and UI components must have sufficient color contrast to be readable by users with low vision or color blindness. WCAG 2.2 Level AA requires:\n- Normal text: 4.5:1 contrast ratio\n- Large text (18pt+): 3:1 contrast ratio\n- UI components: 3:1 contrast ratio',
      impact: '8 elements are not accessible to users with low vision, color blindness, or viewing in bright sunlight. This violates WCAG 2.2 Level AA and may result in legal complaints under ADA/Section 508.',
      fixManual: JSON.stringify([
        'Use browser DevTools or WebAIM Contrast Checker to test color combinations',
        'Increase contrast by darkening text or lightening backgrounds (or vice versa)',
        'For large text (18pt+), minimum ratio is 3:1 (more lenient)',
        'For UI components (buttons, form borders), ensure 3:1 ratio against adjacent colors',
      ]),
      fixAiPrompt: 'I have 8 color contrast violations on my website. Help me identify which colors need adjustment and suggest accessible combinations that meet 4.5:1 ratio.',
    },
    {
      id: 'mock-2',
      module: 'P3-03',
      category: 'Accessibility',
      severity: 'HIGH' as const,
      title: 'Images missing alt text (5 images)',
      location: 'WCAG 1.1.1 - Non-text Content',
      evidence: '5 images without alt attributes',
      explanation: 'All images must have alt attributes. Use descriptive alt text for informative images, alt="" for decorative images.',
      impact: 'Screen reader users cannot understand what 5 images show. This violates WCAG 2.2 Level A (critical baseline).',
      fixManual: JSON.stringify([
        'Add alt="" for decorative images (icons, spacers, purely aesthetic)',
        'Write descriptive alt text for informative images',
        'Avoid redundant phrases like "image of" or "picture of"',
      ]),
      fixAiPrompt: 'I have 5 images without alt text. Help me write appropriate alt text.',
    },
  ];
}
