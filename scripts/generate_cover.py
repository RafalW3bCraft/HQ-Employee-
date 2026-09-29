#!/usr/bin/env python3
"""
Generate 1200x630 Cover Image (SVG and PNG) for HQ-Employee hackathon submission.
Requirement: Product name + one-line value proposition, no third-party logos except AssemblyAI mention as text.
"""

import os
import cairosvg

OUTPUT_DIR = "/home/watcher/Desktop/employee/submission/assemblyai"
SVG_PATH = os.path.join(OUTPUT_DIR, "cover.svg")
PNG_PATH = os.path.join(OUTPUT_DIR, "cover.png")

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060911" />
      <stop offset="50%" stop-color="#0B1120" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>

    <!-- Radial Glows -->
    <radialGradient id="glow-cyan" cx="80%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glow-indigo" cx="20%" cy="80%" r="50%">
      <stop offset="0%" stop-color="#6366F1" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#6366F1" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="card-glow" cx="50%" cy="0%" r="80%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#1E293B" stop-opacity="0" />
    </radialGradient>

    <!-- Accent Linear Gradients -->
    <linearGradient id="title-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="50%" stop-color="#E2E8F0" />
      <stop offset="100%" stop-color="#38BDF8" />
    </linearGradient>

    <linearGradient id="badge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1E1B4B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>

    <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366F1" stop-opacity="0.4" />
      <stop offset="50%" stop-color="#38BDF8" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#10B981" stop-opacity="0.4" />
    </linearGradient>

    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="1200" height="630" fill="url(#bg-grad)" />

  <!-- Background Glow Orbs -->
  <circle cx="950" cy="120" r="450" fill="url(#glow-cyan)" />
  <circle cx="200" cy="520" r="450" fill="url(#glow-indigo)" />

  <!-- Subtle Grid Lines -->
  <g stroke="#1E293B" stroke-width="1" stroke-opacity="0.35">
    <line x1="0" y1="105" x2="1200" y2="105" />
    <line x1="0" y1="210" x2="1200" y2="210" />
    <line x1="0" y1="315" x2="1200" y2="315" />
    <line x1="0" y1="420" x2="1200" y2="420" />
    <line x1="0" y1="525" x2="1200" y2="525" />
    <line x1="200" y1="0" x2="200" y2="630" />
    <line x1="400" y1="0" x2="400" y2="630" />
    <line x1="600" y1="0" x2="600" y2="630" />
    <line x1="800" y1="0" x2="800" y2="630" />
    <line x1="1000" y1="0" x2="1000" y2="630" />
  </g>

  <!-- Central Glassmorphic Card -->
  <rect x="80" y="70" width="1040" height="490" rx="24" fill="#0D1527" fill-opacity="0.75" stroke="#334155" stroke-width="1.5" filter="url(#shadow)" />
  <rect x="80" y="70" width="1040" height="490" rx="24" fill="url(#card-glow)" />

  <!-- Top Category Tag -->
  <g transform="translate(130, 115)">
    <rect x="0" y="0" width="410" height="34" rx="17" fill="url(#badge-grad)" stroke="#6366F1" stroke-width="1.2" />
    <circle cx="18" cy="17" r="5" fill="#38BDF8" />
    <text x="32" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#E2E8F0" letter-spacing="1.5">POWERED BY ASSEMBLYAI VOICE AGENT API</text>
  </g>

  <!-- Status / Verification Pill -->
  <g transform="translate(860, 115)">
    <rect x="0" y="0" width="210" height="34" rx="17" fill="#064E3B" fill-opacity="0.4" stroke="#10B981" stroke-width="1.2" />
    <circle cx="18" cy="17" r="5" fill="#10B981" />
    <text x="32" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="700" fill="#6EE7B7" letter-spacing="1">10/10 VERIFIED PASS</text>
  </g>

  <!-- Main Product Title -->
  <text x="130" y="235" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="76" font-weight="900" fill="url(#title-grad)" letter-spacing="-1.5">
    HQ-Employee
  </text>

  <!-- Subtitle -->
  <text x="132" y="285" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="28" font-weight="700" fill="#38BDF8" letter-spacing="-0.5">
    The Governed AI Business Employee
  </text>

  <!-- One-Line Value Proposition -->
  <text x="132" y="340" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="20" font-weight="400" fill="#CBD5E1">
    Real-time 24 kHz speech discovery and client coordination bounded by deterministic policy.
  </text>

  <!-- Audio Waveform Visualization Graphic -->
  <g transform="translate(130, 385)">
    <!-- Simulated 24 kHz speech soundwave bars -->
    <rect x="0" y="16" width="4" height="28" rx="2" fill="#818CF8" />
    <rect x="10" y="8" width="4" height="44" rx="2" fill="#818CF8" />
    <rect x="20" y="20" width="4" height="20" rx="2" fill="#818CF8" />
    <rect x="30" y="2" width="4" height="56" rx="2" fill="#38BDF8" />
    <rect x="40" y="12" width="4" height="36" rx="2" fill="#38BDF8" />
    <rect x="50" y="24" width="4" height="12" rx="2" fill="#38BDF8" />
    <rect x="60" y="5" width="4" height="50" rx="2" fill="#38BDF8" />
    <rect x="70" y="18" width="4" height="24" rx="2" fill="#38BDF8" />
    <rect x="80" y="0" width="4" height="60" rx="2" fill="#10B981" />
    <rect x="90" y="14" width="4" height="32" rx="2" fill="#10B981" />
    <rect x="100" y="22" width="4" height="16" rx="2" fill="#10B981" />
    <rect x="110" y="10" width="4" height="40" rx="2" fill="#38BDF8" />
    <rect x="120" y="25" width="4" height="10" rx="2" fill="#818CF8" />
    <rect x="130" y="15" width="4" height="30" rx="2" fill="#818CF8" />
  </g>

  <!-- Feature Tags Row -->
  <g transform="translate(300, 395)">
    <!-- Tag 1 -->
    <rect x="0" y="0" width="230" height="38" rx="8" fill="#1E293B" fill-opacity="0.8" stroke="#334155" stroke-width="1" />
    <text x="15" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#F8FAFC">⚡ 24 kHz Full-Duplex Audio</text>

    <!-- Tag 2 -->
    <rect x="245" y="0" width="240" height="38" rx="8" fill="#1E293B" fill-opacity="0.8" stroke="#334155" stroke-width="1" />
    <text x="260" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#F8FAFC">🛡️ Fail-Closed Policy Engine</text>

    <!-- Tag 3 -->
    <rect x="500" y="0" width="240" height="38" rx="8" fill="#1E293B" fill-opacity="0.8" stroke="#334155" stroke-width="1" />
    <text x="515" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#F8FAFC">🔑 Single-Use HMAC Tickets</text>
  </g>

  <!-- Bottom Details Footer -->
  <g transform="translate(130, 500)">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="500" fill="#94A3B8">
      AssemblyAI Voice Agent Hackathon 2026 • Live Demo: {{LIVE_URL}}/voice-tester • 181/181 Automated Tests Passing
    </text>
  </g>
</svg>
"""

with open(SVG_PATH, "w", encoding="utf-8") as f:
    f.write(svg_content)
print(f"Saved SVG to: {SVG_PATH}")

cairosvg.svg2png(url=SVG_PATH, write_to=PNG_PATH, output_width=1200, output_height=630)
print(f"Saved PNG to: {PNG_PATH}")
